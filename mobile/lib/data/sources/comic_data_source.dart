import 'dart:typed_data';

import '../models/comic_models.dart';

enum ConnectionPreference { auto, lanOnly, directOnly }

enum ActiveMode { lanServer, directJm }

enum MobileReaderMode { vertical, singleLtr, singleRtl, doublePage }

enum AppThemeMode { system, light, dark }

enum CoverPrivacyMode { show, blur, hide }

abstract class ComicDataSource {
  ActiveMode get mode;
  bool get supportsPostingComments;
  bool get supportsWebOnlyFilters;
  bool get supportsServerDownload;

  Future<List<({String title, List<ComicSummary> albums})>> getPromoteSections();
  Future<List<ComicSummary>> getLatest({int page = 1});
  Future<CategoryMetaResult> getCategoriesMeta();
  Future<WeekMetaResult> getWeekMeta();
  Future<List<ComicSummary>> getWeekFilter(String categoryId, {String typeId = 'manga'});
  Future<PagedComicsResult> getRanking(String type, {int page = 1, String category = '0'});
  Future<PagedComicsResult> getCategoryFilter({
    int page = 1,
    String time = 'a',
    String orderBy = 'mv',
    String category = '0',
    String? subCategory,
  });
  Future<PagedComicsResult> search(
    String query, {
    String type = 'all',
    int page = 1,
    String orderBy = 'mr',
    String time = 'a',
    String category = '0',
    String? subCategory,
  });
  Future<List<CommentItemModel>> getForumComments({int page = 1});
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
  Future<DailyCheckinInfo> getDailyInfo();
  Future<CheckinResult> dailyCheckin();
  Future<void> postComment(String albumId, String comment, {String? commentId, bool spoiler = false});
  Future<String> createServerDownload(String albumId, {String downloadType = 'folder', String? photoId});
}
