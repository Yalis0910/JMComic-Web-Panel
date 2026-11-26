import 'dart:isolate';
import 'dart:typed_data';

import 'package:image/image.dart' as img;

import 'jm_crypto.dart';

class JmImageDecoder {
  static const int scramble268850 = 268850;
  static const int scramble421926 = 421926;

  static int getNum(int scrambleId, int aid, String filenameWithoutExt) {
    if (aid < scrambleId) return 0;
    if (aid < scramble268850) return 10;
    final x = aid < scramble421926 ? 10 : 8;
    final digest = JmCrypto.md5Hex('$aid$filenameWithoutExt');
    final lastCode = digest.codeUnitAt(digest.length - 1);
    return (lastCode % x) * 2 + 2;
  }

  static int getNumByUrl(int scrambleId, String url) {
    final cleanUrl = url.split('?').first;
    final match = RegExp(r'/media/photos/(\d+)/([^/]+)$').firstMatch(cleanUrl);
    if (match == null) return 0;
    final aid = int.tryParse(match.group(1) ?? '') ?? 0;
    final file = match.group(2) ?? '';
    final dotIdx = file.lastIndexOf('.');
    final baseName = dotIdx > 0 ? file.substring(0, dotIdx) : file;
    return getNum(scrambleId, aid, baseName);
  }

  static Uint8List decodeStripsSync(Uint8List rawBytes, int num) {
    if (num <= 0) return rawBytes;
    final src = img.decodeImage(rawBytes);
    if (src == null) return rawBytes;

    final w = src.width;
    final h = src.height;
    final dst = img.Image(width: w, height: h);
    final over = h % num;

    for (var i = 0; i < num; i++) {
      final baseMove = h ~/ num;
      final ySrc = h - (baseMove * (i + 1)) - over;
      final yDst = baseMove * i + (i == 0 ? 0 : over);
      final sliceH = i == 0 ? baseMove + over : baseMove;

      final cropped = img.copyCrop(src, x: 0, y: ySrc, width: w, height: sliceH);
      img.compositeImage(dst, cropped, dstX: 0, dstY: yDst);
    }

    return Uint8List.fromList(img.encodeJpg(dst, quality: 92));
  }

  static Future<Uint8List> decodeStrips(Uint8List rawBytes, int num) {
    if (num <= 0) return Future.value(rawBytes);
    return Isolate.run(() => decodeStripsSync(rawBytes, num));
  }
}
