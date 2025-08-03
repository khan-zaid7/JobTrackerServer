import PipelineSession from '../models/PipelineSession.js';
import User from '../models/User.js';
import ScrapedJob from '../models/ScrapedJob.js';

export async function getAllPipelineSession(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) throw new Error("User not defined.");

    // get all pipeline sessions for today for this user
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const endOfDay = new Date(now.setHours(23, 59, 59, 999));

    const pipelineSessions = await PipelineSession.find({
      userId: user._id,
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    }).sort({ createdAt: -1 });

    const formattedSessions = pipelineSessions.map(session => ({
      userId: session.userId,
      batchId: session.batchId,         // This is OK to include if you use it to fetch jobs
      note: session.note || '',
      jobCount: session.jobCount || '0',
      status: session.status,
      resumeId: session.resumeId || null,
      error: session.error || null,
    }));

    return res.status(200).json({ sessions: formattedSessions });
  } catch (error) {
    console.error("Error fetching pipeline sessions:", error);
    return res.status(500).json({ error: error.message });
  }
}


export async function getAllScrapedJob(req, res) {
  try {
    const batchId = req.params.batchId;

    if (!batchId) {
      return res.status(400).json({ error: 'batchId query parameter is required' });
    }

    const userId = req.user.id;

    // Get matched jobs
    const matched = await ScrapedJob.find({
      batchId,
      createdBy: userId,
      isRelevant: true,
      is_deleted: false,
    }).populate('resumeId').populate('createdBy', 'name email');

    // Get borderline jobs (include rejectionReason just in case)
    const borderlineRaw = await ScrapedJob.find({
      batchId,
      createdBy: userId,
      isRelevant: false,
      is_deleted: false,
    }).populate('resumeId').populate('createdBy', 'name email');

    const borderline = borderlineRaw.map(job => ({
      ...job.toObject(),
      rejectionReason: job.rejectionReason || 'Borderline (no reason provided)',
    }));

    // Get rejected jobs
    const rejectedRaw = await ScrapedJob.find({
      batchId,
      createdBy: userId,
      is_deleted: true,
    }).populate('resumeId').populate('createdBy', 'name email');

    const rejected = rejectedRaw.map(job => ({
      ...job.toObject(),
      rejectionReason: job.rejectionReason || 'Rejected (no reason provided)',
    }));

    return res.status(200).json({
      success: true,
      batchId,
      total: matched.length + borderline.length + rejected.length,
      matched,
      borderline,
      rejected,
    });

  } catch (error) {
    console.error('[getAllScrapedJob] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
