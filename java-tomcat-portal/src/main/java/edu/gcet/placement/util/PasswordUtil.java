package edu.gcet.placement.util;

import org.mindrot.jbcrypt.BCrypt;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.spec.InvalidKeySpecException;
import java.util.Base64;

/**
 * Cryptographic password hashing utility using BCrypt (cost 10) with PBKDF2 legacy verification fallback.
 */
public final class PasswordUtil {
    private static final int BCRYPT_ROUNDS = 10;
    private static final int LEGACY_ITERATIONS = 65536;
    private static final int LEGACY_KEY_LENGTH = 256;
    private static final SecureRandom RANDOM = new SecureRandom();

    private PasswordUtil() {}

    public static String generateSalt() {
        byte[] salt = new byte[16];
        RANDOM.nextBytes(salt);
        return Base64.getEncoder().encodeToString(salt);
    }

    public static String hashPassword(String rawPassword, String ignoredLegacySalt) {
        return BCrypt.hashpw(rawPassword, BCrypt.gensalt(BCRYPT_ROUNDS));
    }

    public static String hashPassword(String rawPassword) {
        return BCrypt.hashpw(rawPassword, BCrypt.gensalt(BCRYPT_ROUNDS));
    }

    public static boolean verifyPassword(String rawPassword, String storedHash, String legacySalt) {
        if (rawPassword == null || storedHash == null) {
            return false;
        }
        if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$")) {
            return BCrypt.checkpw(rawPassword, storedHash);
        }
        if (legacySalt == null) {
            return false;
        }
        try {
            PBEKeySpec spec = new PBEKeySpec(
                    rawPassword.toCharArray(),
                    legacySalt.getBytes(),
                    LEGACY_ITERATIONS,
                    LEGACY_KEY_LENGTH
            );
            SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            byte[] encoded = factory.generateSecret(spec).getEncoded();
            String computed = Base64.getEncoder().encodeToString(encoded);
            return MessageDigest.isEqual(computed.getBytes(), storedHash.getBytes());
        } catch (NoSuchAlgorithmException | InvalidKeySpecException e) {
            return false;
        }
    }
}
