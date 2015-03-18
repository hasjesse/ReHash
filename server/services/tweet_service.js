var GoogleSheetService = require('../services/google_sheet_service');

function TweetService(url) {
  this.url = url;
  this.sheetService = new GoogleSheetService(url);
}

TweetService.prototype.getAll = function (next) {
  this.sheetService.getData(function (result) {
    return next(result);
  });
}

module.exports = TweetService;

