package org.christchurchhowick.churchhub;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
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

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

/**
 * Church Hub for Android.
 *
 * The app shows the Church Hub website full screen (members land on "Me": their details, days away and serving),
 * so everyone always has the newest version without updating the app. Like the Leave Manager app, it adds what a
 * phone app should do: Android's own "Sign in with Google", the back button, links opening in the right app,
 * choosing files (and taking a photo with the camera), saving downloads, and an offline screen. Church data is never
 * stored by the app itself – only a download someone asks for, saved in the phone's Downloads.
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
    /** Where the camera puts a photo just taken (in the app's own cache), until the page has read it. */
    private File cameraFile;
    private Uri cameraUri;

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
        boolean fromCamera = cameraFile != null && cameraFile.length() > 0
                && (data == null || (data.getData() == null && data.getClipData() == null));
        if (resultCode == RESULT_OK && fromCamera) {
            picked = new Uri[] { cameraUri };
        } else if (resultCode == RESULT_OK && data != null) {
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

    /** Lets "Choose file" buttons work (e.g. an Administrator importing a spreadsheet). For a photo it also offers the camera. */
    private class Chrome extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            try {
                Intent pick = params.createIntent();
                if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                Intent camera = wantsPhoto(params) ? cameraIntent() : null;
                if (camera != null) {
                    Intent choose = Intent.createChooser(pick, "Add a photo");
                    choose.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[] { camera });
                    startActivityForResult(choose, PICK_FILE);
                } else {
                    startActivityForResult(pick, PICK_FILE);
                }
                return true;
            } catch (ActivityNotFoundException e) {
                fileCallback = null;
                Toast.makeText(MainActivity.this, "No app on this phone can choose files.", Toast.LENGTH_LONG).show();
                return false;
            }
        }
    }

    /** True when the page asks for a picture (e.g. Add photo), so the camera can be offered too. */
    private static boolean wantsPhoto(WebChromeClient.FileChooserParams params) {
        String[] types = params.getAcceptTypes();
        if (types == null) return false;
        for (String t : types) if (t != null && t.trim().startsWith("image")) return true;
        return false;
    }

    /** The phone's camera app, saving the photo into this app's cache (shared through the app's FileProvider). */
    private Intent cameraIntent() {
        Intent take = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (take.resolveActivity(getPackageManager()) == null) return null;
        try {
            File dir = new File(getCacheDir(), "camera");
            if (!dir.exists() && !dir.mkdirs()) return null;
            File[] old = dir.listFiles();
            if (old != null) for (File f : old) f.delete();   // only ever the photo being added now
            cameraFile = new File(dir, "photo-" + System.currentTimeMillis() + ".jpg");
            cameraUri = FileProvider.getUriForFile(this, getPackageName() + ".files", cameraFile);
            take.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
            take.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            return take;
        } catch (Exception e) {
            cameraFile = null; cameraUri = null;
            return null;
        }
    }

    /**
     * Saves a download from the page (an Advanced search CSV, someone's data export) in the phone's Downloads folder,
     * then offers to open it. Older phones (before Android 10) get the share menu instead: email, Drive, Files…
     */
    private void saveDownload(String name, String mime, String text) {
        String safe = (name == null || name.trim().isEmpty() ? "church-hub-download.txt" : name).replaceAll("[\\\\/:*?\"<>|]", "-");
        String type = (mime == null || mime.trim().isEmpty()) ? "text/plain" : mime;
        byte[] bytes = (text == null ? "" : text).getBytes(StandardCharsets.UTF_8);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentResolver cr = getContentResolver();
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, safe);
            v.put(MediaStore.MediaColumns.MIME_TYPE, type);
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (uri != null) {
                try (OutputStream out = cr.openOutputStream(uri)) {
                    if (out == null) throw new Exception("no stream");
                    out.write(bytes);
                    final Uri saved = uri;
                    new AlertDialog.Builder(this)
                        .setTitle("Saved in Downloads")
                        .setMessage(safe)
                        .setNegativeButton("OK", null)
                        .setPositiveButton("Open", (d, w) -> {
                            Intent open = new Intent(Intent.ACTION_VIEW).setDataAndType(saved, type).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            try { startActivity(open); }
                            catch (ActivityNotFoundException e) { Toast.makeText(this, "No app on this phone can open " + safe + ". It's in Downloads.", Toast.LENGTH_LONG).show(); }
                        })
                        .show();
                    return;
                } catch (Exception e) {
                    cr.delete(uri, null, null);
                }
            }
        }
        // Older phones, or saving didn't work: the share menu, with the file's text
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType(type.startsWith("text/") ? type : "text/plain");
        send.putExtra(Intent.EXTRA_SUBJECT, safe);
        send.putExtra(Intent.EXTRA_TITLE, safe);
        send.putExtra(Intent.EXTRA_TEXT, text == null ? "" : text);
        try { startActivity(Intent.createChooser(send, "Save or send " + safe)); }
        catch (ActivityNotFoundException e) { Toast.makeText(this, "No app on this phone can save that.", Toast.LENGTH_LONG).show(); }
    }

    /** Functions the Church Hub page can call, as window.ChurchHubApp.*. */
    private class Bridge {
        @JavascriptInterface
        public String version() { return BuildConfig.VERSION_NAME; }

        /** A download from the page: saved in Downloads (see saveDownload). */
        @JavascriptInterface
        public void saveFile(String name, String mime, String text) {
            runOnUiThread(() -> saveDownload(name, mime, text));
        }

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
