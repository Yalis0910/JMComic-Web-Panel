import 'dart:convert';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:encrypt/encrypt.dart' as enc;

class JmCrypto {
  static const String appTokenSecret = '18comicAPP';
  static const String appTokenSecret2 = '18comicAPPContent';
  static const String appDataSecret = '185Hcomic3PAPP7R';
  static const String apiDomainServerSecret = 'diosfjckwpqpdfjkvnqQjsik';
  static String appVersion = '2.0.21';

  static String md5Hex(String input) {
    return md5.convert(utf8.encode(input)).toString();
  }

  static ({String token, String tokenparam}) buildHeadersAuth(
    int ts, {
    String? ver,
    String secret = appTokenSecret,
  }) {
    final version = ver ?? appVersion;
    final tokenparam = '$ts,$version';
    final token = md5Hex('$ts$secret');
    return (token: token, tokenparam: tokenparam);
  }

  static String decodeRespData(
    String base64Data,
    String ts, {
    String secret = appDataSecret,
  }) {
    final cleanB64 = base64Data.trim();
    final encryptedBytes = base64Decode(cleanB64);
    final keyStr = md5Hex('$ts$secret');
    final key = enc.Key.fromUtf8(keyStr);
    final encrypter = enc.Encrypter(enc.AES(key, mode: enc.AESMode.ecb, padding: null));
    final decrypted = encrypter.decryptBytes(enc.Encrypted(encryptedBytes));

    if (decrypted.isEmpty) return '';
    final padLen = decrypted.last;
    final end = (padLen > 0 && padLen <= 16 && padLen <= decrypted.length)
        ? decrypted.length - padLen
        : decrypted.length;
    return utf8.decode(Uint8List.fromList(decrypted.sublist(0, end)));
  }
}
