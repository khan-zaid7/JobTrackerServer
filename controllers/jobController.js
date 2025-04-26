import Job from '../models/Job.js';

export const createJob = async (req, res) => {
  req.body.createdBy = req.user.id;
  const job = await Job.create(req.body);
  res.status(201).json(job);
};

export const getAllJobs = async (req, res) => {
  try {
    const { page = 1, limit = 6, search = '', sortBy = 'createdAt', order = 'desc' } = req.query;
    const skip = (page - 1) * limit;

    const searchRegex = new RegExp(search, 'i');
    const query = {
      createdBy: req.user.id,
      $or: [
        { position: searchRegex },
        { company: searchRegex },
        { location: searchRegex },
        { status: searchRegex },
        { description: searchRegex },
        { salary: searchRegex },
        { url: searchRegex }
      ]
    };

    const total = await Job.countDocuments(query);
    const jobs = await Job.find(query)
      .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      jobs,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch jobs' });
  }
};


export const getJob = async (req, res) => {
  const job = await Job.findOne({
    _id: req.params.id,
    createdBy: req.user.id,
  });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.status(200).json(job);
};

export const updateJob = async (req, res) => {
  const job = await Job.findOneAndUpdate(
    { _id: req.params.id, createdBy: req.user.id },
    req.body,
    { new: true }
  );
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.status(200).json(job);
};

export const deleteJob = async (req, res) => {
  const job = await Job.findOneAndDelete({
    _id: req.params.id,
    createdBy: req.user.id,
  });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.status(200).json({ message: 'Job deleted' });
};
