import MatchResult from '../models/MatchResult.js';

// @desc    Get all match results
// @route   GET /api/match-results
export const getAllMatchResults = async (req, res) => {
  try {
    const results = await MatchResult.find()
      .populate('jobId')
      .populate('resumeId')
      .sort({ createdAt: -1 });

    res.json(results);
  } catch (error) {
    console.error('Error fetching match results:', error);
    res.status(500).json({ message: 'Server error while fetching match results' });
  }
};

// @desc    Get single match result
// @route   GET /api/match-results/:id
export const getMatchResultById = async (req, res) => {
  try {
    const result = await MatchResult.findById(req.params.id)
      .populate('jobId')
      .populate('resumeId');

    if (!result) {
      return res.status(404).json({ message: 'Match result not found' });
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching match result:', error);
    res.status(500).json({ message: 'Server error while fetching match result' });
  }
};
