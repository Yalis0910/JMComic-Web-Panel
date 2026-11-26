import 'dart:convert';

import 'package:encrypt/encrypt.dart' as enc;
import 'package:flutter_test/flutter_test.dart';
import 'package:jmcomic_panel_app/core/network/jm_crypto.dart';

void main() {
  test('buildHeadersAuth computes md5 token and tokenparam', () {
    final auth = JmCrypto.buildHeadersAuth(1700566805, ver: '1.6.3', secret: '18comicAPP');
    expect(auth.tokenparam, '1700566805,1.6.3');
    expect(auth.token, JmCrypto.md5Hex('170056680518comicAPP'));
  });

  test('decodeRespData decrypts AES-ECB base64 payload', () {
    const ts = '1700566805';
    final plain = '{"id":12345,"name":"Test"}';
    final keyStr = JmCrypto.md5Hex('$ts${JmCrypto.appDataSecret}');
    final key = enc.Key.fromUtf8(keyStr);
    final encrypter = enc.Encrypter(enc.AES(key, mode: enc.AESMode.ecb));
    final encrypted = encrypter.encrypt(plain);

    final decoded = JmCrypto.decodeRespData(encrypted.base64, ts);
    expect(jsonDecode(decoded)['id'], 12345);
  });
}
