package com.sidecamp.app;

import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;

// SAF tree/document content:// URIs (returned by pick()) are not directory
// listing / readable through @capacitor/filesystem — that plugin only
// understands file:// paths and single-file content:// reads. list()/readFile()
// below talk to DocumentsContract / ContentResolver directly instead.
@CapacitorPlugin(name = "FolderPicker")
public class FolderPickerPlugin extends Plugin {

    @PluginMethod
    public void pick(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "pickResult");
    }

    @ActivityCallback
    private void pickResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != android.app.Activity.RESULT_OK || result.getData() == null) {
            call.resolve(new JSObject().put("uri", ""));
            return;
        }
        Uri treeUri = result.getData().getData();
        if (treeUri == null) {
            call.resolve(new JSObject().put("uri", ""));
            return;
        }
        getContext().getContentResolver().takePersistableUriPermission(
                treeUri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        );
        call.resolve(new JSObject().put("uri", treeUri.toString()));
    }

    @PluginMethod
    public void list(PluginCall call) {
        String uriString = call.getString("uri");
        if (uriString == null) {
            call.reject("uri required");
            return;
        }
        Uri uri = Uri.parse(uriString);
        String docId = DocumentsContract.isDocumentUri(getContext(), uri)
                ? DocumentsContract.getDocumentId(uri)
                : DocumentsContract.getTreeDocumentId(uri);
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(uri, docId);

        JSArray files = new JSArray();
        ContentResolver resolver = getContext().getContentResolver();
        String[] projection = {
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE,
                DocumentsContract.Document.COLUMN_SIZE,
        };
        try (Cursor cursor = resolver.query(childrenUri, projection, null, null, null)) {
            while (cursor != null && cursor.moveToNext()) {
                Uri childUri = DocumentsContract.buildDocumentUriUsingTree(uri, cursor.getString(0));
                JSObject entry = new JSObject();
                entry.put("name", cursor.getString(1));
                entry.put("uri", childUri.toString());
                entry.put("isDirectory", DocumentsContract.Document.MIME_TYPE_DIR.equals(cursor.getString(2)));
                entry.put("size", cursor.getLong(3));
                files.put(entry);
            }
        } catch (Exception e) {
            call.reject("List failed: " + e.getMessage());
            return;
        }
        call.resolve(new JSObject().put("files", files));
    }

    @PluginMethod
    public void readFile(PluginCall call) {
        String uriString = call.getString("uri");
        if (uriString == null) {
            call.reject("uri required");
            return;
        }
        Uri uri = Uri.parse(uriString);
        try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
            if (in == null) {
                call.reject("Cannot open file");
                return;
            }
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[64 * 1024];
            int n;
            while ((n = in.read(chunk)) != -1) {
                buffer.write(chunk, 0, n);
            }
            call.resolve(new JSObject().put("data", Base64.encodeToString(buffer.toByteArray(), Base64.NO_WRAP)));
        } catch (Exception e) {
            call.reject("Read failed: " + e.getMessage());
        }
    }
}
