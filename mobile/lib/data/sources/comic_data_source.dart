import 'dart:typed_data';

import '../models/comic_models.dart';

enum ConnectionPreference { auto, lanOnly, directOnly }

enum ActiveMode { lanServer, directJm }

abstract class ComicDataSource {
  ActiveMode get mode;

  Future<List<({String title, List<ComicSummary> albums})>> getPromoteSections();
  Future<List<ComicSummary>> getRanking(String type, {int page = 1, String category = '0'});
  Future<List<ComicSummary>> search(String query, {String type = 'all', int page = 1});
  Future<ComicDetail> getAlbumDetail(String albumId);
  Future<List<ChapterImageItem>> getChapterImages(String photoId);
  Future<List<CommentItemModel>> getComments(String albumId, {int page = 1});
  Future<Uint8List> fetchChapterImageBytes(ChapterImageItem item);
}
