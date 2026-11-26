import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:jmlis/core/network/jm_image_decoder.dart';

void main() {
  test('getNumByUrl matches JMComic segmentation rules', () {
    expect(JmImageDecoder.getNum(220980, 200000, '00001'), 0);
    expect(JmImageDecoder.getNum(220980, 250000, '00001'), 10);
    final n = JmImageDecoder.getNumByUrl(
      220980,
      'https://cdn-msp.jmapiproxy1.cc/media/photos/498976/00001.webp?v=1',
    );
    expect(n >= 2 && n % 2 == 0, isTrue);
  });

  test('decodeStripsSync restores vertical strip order', () {
    const w = 20;
    const h = 62;
    const num = 6;
    final orig = img.Image(width: w, height: h);
    for (var y = 0; y < h; y++) {
      final c = y < h ~/ 2 ? img.ColorRgb8(255, 0, 0) : img.ColorRgb8(0, 0, 255);
      for (var x = 0; x < w; x++) {
        orig.setPixel(x, y, c);
      }
    }

    final scrambled = img.Image(width: w, height: h);
    final over = h % num;
    for (var i = 0; i < num; i++) {
      final baseMove = h ~/ num;
      final ySrc = baseMove * i + (i == 0 ? 0 : over);
      final yDst = h - (baseMove * (i + 1)) - over;
      final sliceH = i == 0 ? baseMove + over : baseMove;
      final crop = img.copyCrop(orig, x: 0, y: ySrc, width: w, height: sliceH);
      img.compositeImage(scrambled, crop, dstX: 0, dstY: yDst);
    }

    final restoredBytes = JmImageDecoder.decodeStripsSync(
      Uint8List.fromList(img.encodePng(scrambled)),
      num,
    );
    final restored = img.decodeImage(restoredBytes)!;
    final top = restored.getPixel(10, 4);
    final bottom = restored.getPixel(10, h - 4);
    expect(top.r > 200 && top.b < 60, isTrue);
    expect(bottom.b > 200 && bottom.r < 60, isTrue);
  });
}
