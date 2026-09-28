package app.vitaschola;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "KeystoreStorage")
public class KeystoreStoragePlugin extends Plugin {
    private static final String ALIAS = "vie_scolaire_storage_key";
    private static final String PREFS = "keystore_storage";

    private SecretKey secretKey() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (!ks.containsAlias(ALIAS)) {
            KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            kg.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build());
            kg.generateKey();
        }
        return (SecretKey) ks.getKey(ALIAS, null);
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private boolean supported(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            call.reject("unavailable");
            return false;
        }
        return true;
    }

    @PluginMethod
    public void set(PluginCall call) {
        if (!supported(call)) return;
        String name = call.getString("key");
        String value = call.getString("value");
        if (name == null || value == null) { call.reject("key/value manquants"); return; }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, secretKey());
            cipher.updateAAD(name.getBytes(StandardCharsets.UTF_8));
            byte[] ct = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            String stored = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(ct, Base64.NO_WRAP);
            if (!prefs().edit().putString(name, stored).commit()) { call.reject("ecriture impossible"); return; }
            call.resolve();
        } catch (Exception e) {
            call.reject("chiffrement impossible : " + e.getClass().getSimpleName());
        }
    }

    @PluginMethod
    public void get(PluginCall call) {
        if (!supported(call)) return;
        String name = call.getString("key");
        if (name == null) { call.reject("key manquante"); return; }
        JSObject result = new JSObject();
        String stored = prefs().getString(name, null);
        if (stored == null) { result.put("value", JSObject.NULL); call.resolve(result); return; }
        try {
            String[] parts = stored.split(":", 2);
            byte[] iv = Base64.decode(parts[0], Base64.NO_WRAP);
            byte[] ct = Base64.decode(parts[1], Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, secretKey(), new GCMParameterSpec(128, iv));
            cipher.updateAAD(name.getBytes(StandardCharsets.UTF_8));
            result.put("value", new String(cipher.doFinal(ct), StandardCharsets.UTF_8));
            call.resolve(result);
        } catch (Exception e) {
            result.put("value", JSObject.NULL);
            result.put("error", e.getClass().getSimpleName());
            call.resolve(result);
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String name = call.getString("key");
        if (name == null) { call.reject("key manquante"); return; }
        prefs().edit().remove(name).commit();
        call.resolve();
    }
}
