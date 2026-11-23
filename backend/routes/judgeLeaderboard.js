const express = require('express');
const { getJudgeLeaderboard } = require('../lib/judgeLeaderboard');
module.exports = function createJudgeLeaderboardRouter(db) {
  const router = express.Router();
  router.get('/judges', (req, res, next) => {
    try { res.json(getJudgeLeaderboard(db, req.query)); }
    catch (error) {
      if (error.message === 'Invalid leaderboard period') return res.status(400).json({error:error.message});
      next(error);
    }
  });
  return router;
};
