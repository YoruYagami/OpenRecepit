package app.scontrini.trasferta;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/**
 * Receives ACTION_SEND shares (e.g. a PDF receipt shared from Revolut).
 * The web layer polls consume() on launch/resume; the intent is cleared after
 * a successful read so re-foregrounding doesn't re-import the same file.
 */
@CapacitorPlugin(name = "SharedFile")
public class SharedFilePlugin extends Plugin {

    private static final long MAX_BYTES = 20L * 1024L * 1024L;

    @PluginMethod
    public void consume(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            Intent intent = getActivity() != null ? getActivity().getIntent() : null;
            if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) {
                ret.put("data", (String) null);
                call.resolve(ret);
                return;
            }
            Uri uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (uri == null) {
                ret.put("data", (String) null);
                call.resolve(ret);
                return;
            }
            String mime = intent.getType() != null ? intent.getType() : "application/octet-stream";
            String name = queryName(uri);

            InputStream in = getContext().getContentResolver().openInputStream(uri);
            if (in == null) {
                ret.put("data", (String) null);
                call.resolve(ret);
                return;
            }
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[16384];
            int n;
            long total = 0;
            while ((n = in.read(chunk)) > 0) {
                total += n;
                if (total > MAX_BYTES) {
                    in.close();
                    call.reject("file troppo grande");
                    return;
                }
                buf.write(chunk, 0, n);
            }
            in.close();

            // Consume: replace the intent so the same share isn't re-imported.
            getActivity().setIntent(new Intent(Intent.ACTION_MAIN));

            ret.put("data", Base64.encodeToString(buf.toByteArray(), Base64.NO_WRAP));
            ret.put("mimeType", mime);
            ret.put("fileName", name);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("share read failed: " + e.getMessage());
        }
    }

    private String queryName(Uri uri) {
        try (Cursor c = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                int idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (idx >= 0) {
                    String v = c.getString(idx);
                    if (v != null && !v.isEmpty()) return v;
                }
            }
        } catch (Exception ignored) {
            // fall through
        }
        return "documento";
    }
}
