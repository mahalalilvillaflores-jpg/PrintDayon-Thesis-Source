import React, { useState } from 'react';
import { Star, X, Check, ShieldCheck, Sparkles, MessageSquare, ThumbsUp, Printer, FileText } from 'lucide-react';
import { requestAPI } from '../../services/api';
import toast from 'react-hot-toast';

const RATING_MOODS = {
  5: { label: 'Outstanding! 🤩', color: '#16A34A', desc: 'Exceeded all expectations' },
  4: { label: 'Very Good! 😊', color: '#2563EB', desc: 'Satisfied with the print' },
  3: { label: 'Fair / Average 🙂', color: '#D97706', desc: 'Acceptable service' },
  2: { label: 'Disappointed 😕', color: '#EA580C', desc: 'Needs noticeable improvement' },
  1: { label: 'Poor Experience 😞', color: '#DC2626', desc: 'Did not meet expectations' },
};

const QUICK_TAGS = [
  '⚡ Fast Turnaround',
  '📄 Crisp & Clear Text',
  '🎨 Vibrant Colors',
  '💰 Student-Friendly Price',
  '🤝 Friendly Staff',
  '📦 Neat Stapling / Binding',
  '🕒 Ready Before Class',
  '✨ High Quality Paper',
];

const COMMENT_STARTERS = [
  'Ready right on time for my class!',
  'Crisp text clarity and deep ink contrast.',
  'Accommodating and very polite shop staff.',
  'Affordable rates, perfect for student budgets!',
  'Neat stapling and clean paper edges.',
];

export default function RatingReviewModal({
  isOpen,
  onClose,
  request,
  onReviewSubmitted,
}) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [printQuality, setPrintQuality] = useState(5);
  const [speedRating, setSpeedRating] = useState(5);
  const [selectedTags, setSelectedTags] = useState(['⚡ Fast Turnaround', '📄 Crisp & Clear Text']);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !request) return null;

  const currentDisplayRating = hoverRating || rating;
  const mood = RATING_MOODS[currentDisplayRating] || RATING_MOODS[5];
  const shopName = request.shopId?.shopName || request.shopName || 'Printing Shop';
  const fileName = request.fileName || request.documentId?.originalFilename || 'Printed Document';

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const addStarter = (starter) => {
    setComment((prev) => {
      const cleanPrev = prev.trim();
      if (!cleanPrev) return starter;
      if (cleanPrev.includes(starter)) return prev;
      return `${cleanPrev} ${starter}`;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) {
      toast.error('Please select a star rating.');
      return;
    }

    setSubmitting(true);
    try {
      await requestAPI.submitReview(request._id, {
        rating,
        printQuality,
        speedRating,
        tags: selectedTags,
        isAnonymous,
        comment: comment.trim(),
      });

      toast.success('Thank you for rating your printing experience! ⭐', {
        duration: 4000,
        icon: '🎉',
      });

      if (onReviewSubmitted) {
        onReviewSubmitted();
      }
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[92vh] flex flex-col animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5 min-w-0 pr-6">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 flex items-center justify-center text-amber-500 shrink-0">
              <Star size={20} className="fill-amber-400 text-amber-500" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate m-0">
                Rate Your Printing Order
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate m-0 flex items-center gap-1.5 mt-0.5">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{shopName}</span>
                <span>•</span>
                <span className="truncate">{fileName}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors border-none bg-transparent cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto px-5 py-4 flex flex-col gap-5 text-left custom-scrollbar">
          {/* Main 5 Stars Selector with Shopee Emotional Indicator */}
          <div className="flex flex-col items-center justify-center py-2 bg-gradient-to-b from-amber-500/5 to-transparent rounded-2xl p-4 border border-amber-500/10">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Overall Experience
            </span>

            {/* Interactive Stars */}
            <div className="flex items-center gap-2 sm:gap-3 my-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 rounded-lg transition-transform hover:scale-125 focus:outline-none bg-transparent border-none cursor-pointer"
                  title={`${star} Star${star > 1 ? 's' : ''}`}
                >
                  <Star
                    size={36}
                    className={`transition-colors duration-150 ${
                      star <= currentDisplayRating
                        ? 'fill-amber-400 text-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.5)]'
                        : 'fill-slate-200 text-slate-300 dark:fill-slate-800 dark:text-slate-700'
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Shopee Emotion Badge */}
            <div className="mt-2 text-center transition-all duration-200">
              <span
                className="text-sm font-black tracking-wide"
                style={{ color: mood.color }}
              >
                {mood.label}
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {mood.desc}
              </span>
            </div>
          </div>

          {/* Quick Shopee Tag Pills */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" />
                Quick Tags (Tap to highlight)
              </label>
              <span className="text-[11px] text-slate-400">Optional</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                      active
                        ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    {active ? '✓ ' : '+ '}
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detailed Criteria (Print Quality & Speed) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Print Clarity:
                </span>
                <span className="text-xs font-extrabold text-amber-500">
                  {printQuality} / 5
                </span>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPrintQuality(s)}
                    className="p-0.5 bg-transparent border-none cursor-pointer"
                  >
                    <Star
                      size={18}
                      className={s <= printQuality ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-300 dark:fill-slate-700 dark:text-slate-600'}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Turnaround Speed:
                </span>
                <span className="text-xs font-extrabold text-amber-500">
                  {speedRating} / 5
                </span>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpeedRating(s)}
                    className="p-0.5 bg-transparent border-none cursor-pointer"
                  >
                    <Star
                      size={18}
                      className={s <= speedRating ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-300 dark:fill-slate-700 dark:text-slate-600'}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Comment & Feedback Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <MessageSquare size={14} className="text-slate-500" />
                Leave a Comment &amp; Review
              </label>
              <span className={`text-[11px] font-mono ${comment.length > 350 ? 'text-amber-500 font-bold' : 'text-slate-400'}`}>
                {comment.length} / 400
              </span>
            </div>

            <textarea
              rows={3}
              maxLength={400}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                rating >= 4
                  ? 'What did you like most? (e.g. sharp text clarity, smooth pickup, friendly shop owner...)'
                  : 'How can this print shop improve? (e.g. wait time, ink clarity, paper handling...)'
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all resize-none shadow-xs"
            />

            {/* Quick Comment Starters */}
            <div className="mt-2">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                💡 Tap to add quick feedback:
              </span>
              <div className="flex flex-wrap gap-1">
                {COMMENT_STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => addStarter(starter)}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer text-left"
                  >
                    + "{starter}"
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Shopee Post Anonymously Switch */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className={isAnonymous ? 'text-emerald-500' : 'text-slate-400'} />
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Post review anonymously
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isAnonymous ? 'Your name will show as "Anonymous Student"' : 'Your name will be visible to the shop and public'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAnonymous(!isAnonymous)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isAnonymous ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isAnonymous ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-[2] py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-[0.99] transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5 border-none"
            >
              {submitting ? (
                <span>Submitting...</span>
              ) : (
                <>
                  <Star size={15} className="fill-white" />
                  <span>Submit Rating &amp; Review</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
