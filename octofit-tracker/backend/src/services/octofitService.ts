import { Activity, Team, User, Workout } from '../models/index.js';
import mongoose from 'mongoose';

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(input: unknown) {
  if (!input || typeof input !== 'object') {
    throw Object.assign(new Error('Invalid activity input'), { status: 400 });
  }

  const { userId, teamId, type, minutes } = input as {
    userId?: unknown;
    teamId?: unknown;
    type?: unknown;
    minutes?: unknown;
  };

  if (
    typeof userId !== 'string'
    || typeof teamId !== 'string'
    || typeof type !== 'string'
    || type.trim().length === 0
    || typeof minutes !== 'number'
    || !Number.isFinite(minutes)
    || minutes < 1
  ) {
    throw Object.assign(new Error('Invalid activity input'), { status: 400 });
  }

  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(teamId)) {
    throw Object.assign(new Error('Invalid activity reference'), { status: 400 });
  }

  const [user, team] = await Promise.all([
    User.findById(userId).lean(),
    Team.findById(teamId).lean(),
  ]);
  if (!user || !team) {
    throw Object.assign(new Error('Activity reference not found'), { status: 404 });
  }

  const activity = await Activity.create({
    user: user._id,
    team: team._id,
    type: type.trim(),
    minutes,
    points: minutes,
    occurredAt: new Date(),
  });
  return activity.toObject();
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(input: unknown) {
  if (!input || typeof input !== 'object') {
    throw Object.assign(new Error('Team name is required'), { status: 400 });
  }

  const { name, mascot, members } = input as {
    name?: unknown;
    mascot?: unknown;
    members?: unknown;
  };

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw Object.assign(new Error('Team name is required'), { status: 400 });
  }
  if (typeof mascot !== 'string' || mascot.trim().length === 0) {
    throw Object.assign(new Error('Team mascot is required'), { status: 400 });
  }

  let memberIds: mongoose.Types.ObjectId[] = [];
  if (members !== undefined) {
    if (!Array.isArray(members)) {
      throw Object.assign(new Error('Team members must be an array'), { status: 400 });
    }
    if (!members.every((member) => typeof member === 'string' && mongoose.isValidObjectId(member))) {
      throw Object.assign(new Error('Invalid team member reference'), { status: 400 });
    }
    memberIds = members.map((member) => new mongoose.Types.ObjectId(member));
  }

  if (memberIds.length > 0) {
    const existingMembers = await User.find({ _id: { $in: memberIds } }).select('_id').lean();
    if (existingMembers.length !== memberIds.length) {
      throw Object.assign(new Error('Team member not found'), { status: 404 });
    }
  }

  const team = await Team.create({
    name: name.trim(),
    mascot: mascot.trim(),
    members: memberIds,
  });
  return team.toObject();
}

export async function getLeaderboard() {
  const totals = await Activity.aggregate<{ _id: mongoose.Types.ObjectId; totalPoints: number }>([
    { $group: { _id: '$team', totalPoints: { $sum: '$points' } } },
  ]);

  if (totals.length === 0) return [];

  const teamIds = totals.map((total) => total._id);
  const teams = await Team.find({ _id: { $in: teamIds } }).lean();
  const teamNames = new Map(teams.map((team) => [team._id.toString(), team.name]));

  return totals
    .map((total) => ({
      teamName: teamNames.get(total._id.toString()) ?? '',
      totalPoints: total.totalPoints,
    }))
    .filter((entry) => entry.teamName !== '')
    .sort((left, right) => right.totalPoints - left.totalPoints)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export async function suggestWorkouts(userEmail: string) {
  const decodedEmail = decodeURIComponent(userEmail).trim().toLowerCase();
  const user = await User.findOne({ email: decodedEmail }).lean();
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  const recentActivity = await Activity.findOne({ user: user._id })
    .sort({ occurredAt: -1 })
    .lean();

  const activityFocus = recentActivity?.type === 'run' || recentActivity?.type === 'cycle'
    ? 'endurance'
    : recentActivity?.type === 'strength'
      ? 'strength'
      : recentActivity?.type === 'walk'
        ? 'mobility'
        : undefined;
  const focus = activityFocus ?? user.fitnessGoal;

  const workouts = await Workout.find({
    $or: [
      { focus },
      ...(activityFocus && activityFocus !== focus ? [{ focus: activityFocus }] : []),
    ],
  }).lean();

  if (workouts.length === 0) {
    return Workout.find().lean();
  }

  return workouts.map((workout) => ({
    ...workout,
    reason: recentActivity
      ? `Matches ${recentActivity.type} activity and ${focus} fitness goal`
      : `Matches ${user.fitnessGoal} fitness goal`,
  }));
}

export { User };
