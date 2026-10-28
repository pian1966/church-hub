package org.christchurchhowick.churchhub;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.SystemClock;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;

import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

/**
 * Church Hub for Android.
 *
 * The app shows the Church Hub website full screen (members land on "Me": their details, days away and serving),
 * so everyone always has the newest version without updating the app. Like the Leave Manager app, it adds what a
 * phone app should do: Android's own "Sign in with Google", the back button, links opening in the right app,
 * choosing files, and an offline screen. Church data is never stored by the app itself.
 */
public class MainActivity extends Activity {

    private static final String APP_URL = BuildConfig.APP_URL;
    /** Reload when the app comes back after this long in the background, so rosters are fresh. */
    private static final long REFRESH_AFTER_MS = 10 * 60 * 1000;
    private static final int PICK_FILE = 41;

    private WebView web;
    private long pausedAt = 0;
    private boolean showingOffline = false;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // keeps people signed in, and their language
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setUserAgentString(s.getUserAgentString() + " ChurchHubApp/" + BuildConfig.VERSION_NAME);

        web.addJavascriptInterface(new Bridge(), "ChurchHubApp");
        web.setWebChromeClient(new Chrome());
        web.setWebViewClient(new Client());

        if (state != null) web.restoreState(state);
        else web.loadUrl(APP_URL);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        pausedAt = SystemClock.elapsedRealtime();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        if (pausedAt > 0 && SystemClock.elapsedRealtime() - pausedAt > REFRESH_AFTER_MS) {
            if (showingOffline) web.loadUrl(APP_URL); else web.reload();
        }
        pausedAt = 0;
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // Let Church Hub close an open window first; then go back a page; then leave the app.
        web.evaluateJavascript("(window.churchHubBack && window.churchHubBack()) ? 'y' : 'n'", result -> {
            if (result != null && result.contains("y")) return;
            if (web.canGoBack()) web.goBack();
            else confirmLeave();
        });
    }

    /** Before the back button closes the app: "Leave Church Hub?", in the language chosen in Church Hub (js/app.js). */
    private void confirmLeave() {
        web.evaluateJavascript("window.churchHubLeaveText ? window.churchHubLeaveText() : ''", result -> {
            String[] t = { "Leave Church Hub?", "Are you sure you want to close Church Hub?", "Stay", "Close Church Hub" };
            try {
                Object v = new JSONTokener(result).nextValue();
                if (v instanceof String && !((String) v).isEmpty()) {
                    JSONArray a = new JSONArray((String) v);
                    for (int i = 0; i < t.length && i < a.length(); i++) t[i] = a.getString(i);
                }
            } catch (Exception ignored) { /* page not loaded: use English */ }
            if (isFinishing()) return;
            new AlertDialog.Builder(this)
                .setTitle(t[0])
                .setMessage(t[1])
                .setNegativeButton(t[2], null)
                .setPositiveButton(t[3], (dialog, which) -> finish())
                .show();
        });
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != PICK_FILE || fileCallback == null) return;
        Uri[] picked = null;
        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int n = data.getClipData().getItemCount();
                picked = new Uri[n];
                for (int i = 0; i < n; i++) picked[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data.getData() != null) {
                picked = new Uri[] { data.getData() };
            }
        }
        fileCallback.onReceiveValue(picked);
        fileCallback = null;
    }

    private boolean isAppUrl(Uri uri) {
        return uri != null && uri.toString().startsWith(APP_URL);
    }

    private void openOutside(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "No app on this phone can open that link.", Toast.LENGTH_LONG).show();
        }
    }

    private class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            Uri uri = req.getUrl();
            if (isAppUrl(uri)) return false;
            // Email, phone numbers, Google Forms, guides, app downloads: open in the right app.
            openOutside(uri);
            return true;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            if (url != null && url.startsWith(APP_URL)) showingOffline = false;
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
            if (!req.isForMainFrame()) return;
            showingOffline = true;
            view.loadDataWithBaseURL(null, OFFLINE_PAGE, "text/html", "utf-8", null);
        }
    }

    /** Lets "Choose file" buttons work (e.g. an Administrator importing a spreadsheet). */
    private class Chrome extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            try {
                Intent pick = params.createIntent();
                if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                startActivityForResult(pick, PICK_FILE);
                return true;
            } catch (ActivityNotFoundException e) {
                fileCallback = null;
                Toast.makeText(MainActivity.this, "No app on this phone can choose files.", Toast.LENGTH_LONG).show();
                return false;
            }
        }
    }

    /** Functions the Church Hub page can call, as window.ChurchHubApp.*. */
    private class Bridge {
        @JavascriptInterface
        public String version() { return BuildConfig.VERSION_NAME; }

        /** Shows Android's Google account picker; the result goes back to the page (js/store.js, appGoogle). */
        @JavascriptInterface
        public void googleSignIn(String webClientId) {
            runOnUiThread(() -> startGoogleSignIn(webClientId));
        }

        @JavascriptInterface
        public void retry() {
            runOnUiThread(() -> web.loadUrl(APP_URL));
        }
    }

    private void startGoogleSignIn(String webClientId) {
        if (webClientId == null || webClientId.trim().isEmpty()) {
            sendToPage("churchHubGoogleError", "Sign in with Google isn't set up in the app yet. Please use the email link.");
            return;
        }
        GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(webClientId.trim()).build();
        GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
        CredentialManager cm = CredentialManager.create(this);
        cm.getCredentialAsync(this, request, new CancellationSignal(), this::runOnUiThread,
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(GetCredentialResponse response) {
                        Credential c = response.getCredential();
                        if (c instanceof CustomCredential) {
                            try {
                                GoogleIdTokenCredential g = GoogleIdTokenCredential.createFrom(c.getData());
                                sendToPage("churchHubGoogle", g.getIdToken());
                                return;
                            } catch (Exception e) { /* fall through */ }
                        }
                        sendToPage("churchHubGoogleError", "Google sign-in didn't return an account. Please try again.");
                    }

                    @Override
                    public void onError(GetCredentialException e) {
                        if (e instanceof GetCredentialCancellationException) {   // they closed the picker
                            sendToPage("churchHubGoogleCancel", "");
                            return;
                        }
                        String msg = (e instanceof NoCredentialException)
                                ? "No Google account is set up on this phone. Add one in Settings → Accounts, or use the email link."
                                : "Google sign-in didn't work on this phone. Please use the email link instead.";
                        sendToPage("churchHubGoogleError", msg);
                    }
                });
    }

    /** Calls window.<fn>(text) in the page, with the text safely quoted. */
    private void sendToPage(String fn, String text) {
        String arg = JSONObject.quote(text == null ? "" : text);
        web.evaluateJavascript("window." + fn + " && window." + fn + "(" + arg + ")", null);
    }

    private static final String OFFLINE_PAGE =
            "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>" +
            "<style>body{font-family:sans-serif;background:#F6F4F1;color:#1D1B19;display:grid;place-items:center;min-height:90vh;margin:0;text-align:center;padding:24px}" +
            "@media (prefers-color-scheme:dark){body{background:#1D1B19;color:#E9E2DB}}" +
            "h1{font-size:1.3rem}p{color:#645B53;max-width:280px;margin:8px auto 20px}" +
            "button{background:#E8590C;color:#fff;border:0;border-radius:10px;padding:12px 22px;font-size:1rem}</style></head>" +
            "<body><div><h1>You're offline</h1><p>Church Hub needs the internet to show your details and the rosters. Check your Wi-Fi or mobile data.</p>" +
            "<button onclick='ChurchHubApp.retry()'>Try again</button></div></body></html>";
}
