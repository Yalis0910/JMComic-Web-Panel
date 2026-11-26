import 'dart:typed_data';

import '../models/comic_models.dart';

enum ConnectionPreference { auto, lanOnly, directOnly }

enum ActiveMode { lanServer, directJm }

abstract class ComicDataSource {
  ActiveMode get mode;
  bool get supportsPostingComments;

  Future<List<({String title, List<ComicSummary> albums})>> getPromoteSections();
  Future<List<ComicSummary>> getRanking(String type, {int page = 1, String category = '0'});
  Future<List<ComicSummary>> search(String query, {String type = 'all', int page = 1});
  Future<ComicDetail> getAlbumDetail(String albumId);
  Future<List<ChapterImageItem>> getChapterImages(String photoId);
  Future<List<CommentItemModel>> getComments(String albumId, {int page = 1});
  Future<Uint8List> fetchChapterImageBytes(ChapterImageItem item);

  Future<UserAccountStatus> login(String username, String password);
  Future<void> logout();
  Future<UserAccountStatus> getUserStatus();
  Future<FavoritePageResult> getFavorites({int page = 1, String folderId = '0', String orderBy = 'mr'});
  Future<void> addFavorite(String albumId, {String folderId = '0'});
  Future<void> removeFavorite(String albumId);
  Future<CheckinResult> dailyCheckin();
  Future<void> postComment(String albumId, String comment, {String? commentId, bool spoiler = false});
}
