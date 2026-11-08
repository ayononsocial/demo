package com.dclegacy.app;

import android.annotation.SuppressLint;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;
import org.json.JSONTokener;

import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * College portal sync: a hidden browser inside the app that opens the Dhaka College eShiksa portal (dhakacollege.eshiksabd.com)
 * on the phone. The shared college password is typed into the portal's own login form here and goes only to the portal, never to
 * DC Legacy's servers. Only if the student ticks "Remember on this phone" is it kept, encrypted with a key in Android's
 * hardware-backed keystore (the web part of the app never reads it back; login with useSaved fills it in here in Java).
 * The app then asks the portal's own endpoints for the student's academic data (src/eshiksa.js). Only pages on the portal can be opened.
 */
@CapacitorPlugin(name = "PortalSync")
public class PortalSyncPlugin extends Plugin {
    private static final String PORTAL = "https://dhakacollege.eshiksabd.com";
    private WebView web;
    private PluginCall waiting; // the call that resolves on the next page load
    private String waitingFor = "";
    private final Handler ui = new Handler(Looper.getMainLooper());

    private static final String STATUS_JS = "(() => { const f = document.querySelector('form.form-signin');"
        + " const err = [...document.querySelectorAll('.alert, .alert-danger, .text-danger, .error')].map((e) => e.innerText.trim()).filter(Boolean).join(' ').slice(0, 200);"
        + " return JSON.stringify({ url: location.href, login: !!f, error: err }); })()";

    @SuppressLint("SetJavaScriptEnabled")
    private void ensureWeb() {
        if (web != null) return;
        web = new WebView(getActivity());
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportMultipleWindows(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return !req.getUrl().toString().startsWith(PORTAL); // never leave the portal
            }
            @Override
            public void onPageFinished(WebView view, String url) {
                if (waiting == null || url == null || !url.startsWith(PORTAL)) return;
                PluginCall c = waiting; waiting = null;
                ui.postDelayed(() -> afterLoad(c), 700); // let the page's own scripts run
            }
        });
        // Invisible 1×1 view: a WebView needs to be attached to run reliably, but the student never sees the portal.
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(1, 1);
        web.setAlpha(0f);
        web.setVisibility(View.VISIBLE);
        ((ViewGroup) getActivity().getWindow().getDecorView()).addView(web, lp);
    }

    private void expectLoad(PluginCall call, String what, long timeoutMs) {
        waiting = call; waitingFor = what;
        ui.postDelayed(() -> { if (waiting == call) { waiting = null; call.reject("The Dhaka College portal didn't answer. Check your internet and try again."); } }, timeoutMs);
    }

    private void afterLoad(PluginCall c) {
        if ("read".equals(waitingFor) || c.getString("script") != null) { runRead(c, 0); return; }
        eval(STATUS_JS, (r) -> c.resolve(json(r)));
    }

    private interface Cb { void done(String value); }
    private void eval(String js, Cb cb) { web.evaluateJavascript(js, (v) -> { String out = ""; try { Object o = new JSONTokener(v).nextValue(); out = o instanceof String ? (String) o : ""; } catch (Exception ignored) { } cb.done(out); }); }
    private static JSObject json(String s) { try { return JSObject.fromJSONObject(new JSONObject(s)); } catch (Exception e) { JSObject o = new JSObject(); o.put("error", "Unreadable page"); return o; } }

    /** Opens the portal login page; answers with {login:true} (or login:false if already signed in on this phone). */
    @PluginMethod
    public void open(PluginCall call) {
        ui.post(() -> { ensureWeb(); expectLoad(call, "status", 30000); web.loadUrl(PORTAL + "/"); });
    }

    /** Fills Dhaka College's own login form and submits it; answers with the next page's status.
     *  useSaved: true takes the password remembered on this phone instead of `password`. */
    @PluginMethod
    public void login(PluginCall call) {
        String id = call.getString("username", ""), pw = call.getString("password", ""), ans = call.getString("answer", "");
        if (web == null) { call.reject("Open the portal first"); return; }
        if (call.getBoolean("useSaved", false)) {
            String saved = loadPassword(id);
            if (saved == null) { call.reject("No password is remembered for this ID on this phone. Type it once more."); return; }
            pw = saved;
        }
        String js = "(() => { const f = document.querySelector('form.form-signin'); if (!f) return 'noform';"
            + " const set = (n, v) => { const e = f.querySelector('[name=' + n + ']'); if (e) e.value = v; };"
            + " set('username', " + JSONObject.quote(id) + "); set('password', " + JSONObject.quote(pw) + ");"
            + " const b = f.querySelector('[type=submit]'); if (b) b.click(); else HTMLFormElement.prototype.submit.call(f); return 'sent'; })()";
        ui.post(() -> { expectLoad(call, "status", 30000); eval(js, (r) -> { if (!"sent".equals(r)) { waiting = null; call.reject("The portal's login form wasn't found. Try again in a minute."); } }); });
    }

    /** Opens one portal page (path), optionally clicks a button whose text matches `click`, waits until the text
     *  matches `waitFor` (or `timeout` ms), then runs `script` (the privacy filter) and answers with its result. */
    @PluginMethod
    public void read(PluginCall call) {
        String path = call.getString("path", "/");
        if (web == null) { call.reject("Open the portal first"); return; }
        if (!path.startsWith("/") || path.startsWith("//")) { call.reject("Bad portal path"); return; }
        ui.post(() -> { expectLoad(call, "read", 30000); web.loadUrl(PORTAL + path); });
    }

    private void runRead(PluginCall c, int tries) {
        String click = c.getString("click"), waitFor = c.getString("waitFor"), script = c.getString("script", "document.body.innerText");
        int timeout = c.getInt("timeout", 9000);
        if (tries == 0 && click != null) {
            eval("(() => { const re = new RegExp(" + JSONObject.quote(click) + ", 'i'); const b = [...document.querySelectorAll('button, input[type=submit], input[type=button], a')]"
                + ".find((x) => re.test(x.innerText || x.value || '')); if (b) b.click(); return b ? 'clicked' : 'none'; })()", (r) -> ui.postDelayed(() -> runRead(c, 1), 1200));
            return;
        }
        if (waitFor != null && tries * 500 < timeout) {
            eval("(() => new RegExp(" + JSONObject.quote(waitFor) + ", 'i').test(document.body.innerText) ? 'yes' : 'no')()", (r) -> {
                if ("yes".equals(r)) finishRead(c, script); else ui.postDelayed(() -> runRead(c, tries + 1), 500);
            });
            return;
        }
        finishRead(c, script);
    }
    private void finishRead(PluginCall c, String script) {
        eval(script, (r) -> { JSObject o = new JSObject(); o.put("result", r); o.put("url", web.getUrl()); c.resolve(o); });
    }

    /** Runs `script` on the page that is open now (no navigation). With `waitJs` (an expression answering 'yes' or 'no'),
     *  waits until it says yes or `timeout` ms pass, then answers with the value of `result`. Used to read the portal's own
     *  JSON with the student's session; the script itself keeps only academic fields (src/portalsync.js). */
    @PluginMethod
    public void exec(PluginCall call) {
        if (web == null) { call.reject("Open the portal first"); return; }
        String script = call.getString("script", "''");
        ui.post(() -> eval(script, (r) -> {
            if (call.getString("waitJs") == null) { call.resolve(result(r)); return; }
            pollExec(call, System.currentTimeMillis());
        }));
    }
    private void pollExec(PluginCall c, long since) {
        if (web == null) { c.reject("The portal was closed"); return; }
        eval(c.getString("waitJs"), (r) -> {
            if ("yes".equals(r) || System.currentTimeMillis() - since > c.getInt("timeout", 30000)) eval(c.getString("result", "''"), (v) -> c.resolve(result(v)));
            else ui.postDelayed(() -> pollExec(c, since), 400);
        });
    }
    private static JSObject result(String v) { JSObject o = new JSObject(); o.put("result", v); return o; }

    /* ── "Remember on this phone": AES-GCM with a key in the Android keystore ── */
    private static final String KEY_ALIAS = "dclegacy_portal_login";
    private SharedPreferences prefs() { return getContext().getSharedPreferences("portal_login", android.content.Context.MODE_PRIVATE); }
    private SecretKey key() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (!ks.containsAlias(KEY_ALIAS)) {
            KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            kg.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            kg.generateKey();
        }
        return ((KeyStore.SecretKeyEntry) ks.getEntry(KEY_ALIAS, null)).getSecretKey();
    }
    private String loadPassword(String id) {
        SharedPreferences p = prefs();
        String box = p.getString("box", null);
        if (box == null || !id.equals(p.getString("id", ""))) return null;
        try {
            String[] parts = box.split(":");
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
            return new String(c.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8);
        } catch (Exception e) { p.edit().clear().apply(); return null; } // e.g. restored to a new phone: the key isn't there
    }

    /** Remembers the password for this student ID on this phone (encrypted). */
    @PluginMethod
    public void rememberLogin(PluginCall call) {
        String id = call.getString("username", ""), pw = call.getString("password", "");
        if (id.isEmpty() || pw.isEmpty()) { call.reject("Nothing to remember"); return; }
        try {
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, key());
            String box = Base64.encodeToString(c.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(c.doFinal(pw.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
            prefs().edit().putString("id", id).putString("box", box).apply();
            call.resolve();
        } catch (Exception e) { call.reject("This phone couldn't store the password safely."); }
    }

    /** Which student ID has a remembered password (never the password itself). */
    @PluginMethod
    public void savedLogin(PluginCall call) {
        SharedPreferences p = prefs();
        JSObject o = new JSObject();
        o.put("id", p.getString("id", ""));
        o.put("saved", p.getString("box", null) != null);
        call.resolve(o);
    }

    @PluginMethod
    public void forgetLogin(PluginCall call) { prefs().edit().clear().apply(); call.resolve(); }

    /** Saves a PDF the portal produced (base64) in the app's cache and opens it in the phone's PDF viewer. */
    @PluginMethod
    public void openPdf(PluginCall call) {
        String b64 = call.getString("base64", ""), name = call.getString("name", "dc-legacy").replaceAll("[^A-Za-z0-9_-]", "_");
        if (b64.isEmpty()) { call.reject("Nothing to open"); return; }
        try {
            java.io.File dir = new java.io.File(getContext().getCacheDir(), "pdf");
            dir.mkdirs();
            java.io.File f = new java.io.File(dir, name + ".pdf");
            try (java.io.FileOutputStream out = new java.io.FileOutputStream(f)) { out.write(Base64.decode(b64, Base64.DEFAULT)); }
            android.net.Uri uri = androidx.core.content.FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            android.content.Intent i = new android.content.Intent(android.content.Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/pdf");
            i.addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION | android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (android.content.ActivityNotFoundException e) { call.reject("No PDF viewer is installed on this phone."); }
        catch (Exception e) { call.reject("Couldn't open the PDF."); }
    }

    /** Closes the hidden browser and forgets the portal session (signs out of the portal on this phone). */
    @PluginMethod
    public void close(PluginCall call) {
        ui.post(() -> {
            if (web != null) { ((ViewGroup) web.getParent()).removeView(web); web.destroy(); web = null; }
            waiting = null;
            CookieManager.getInstance().removeAllCookies(null);
            CookieManager.getInstance().flush();
            call.resolve();
        });
    }
}
