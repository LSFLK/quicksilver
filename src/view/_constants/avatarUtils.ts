/**
 * Utility function to generate initials from a name
 * @param {string} name - The full name
 * @returns {string} The initials
 */
export const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

/**
 * Get avatar size in pixels
 * @param {string} size - 'small' | 'medium' | 'large'
 * @returns {number} Size in pixels
 */
export const getAvatarSize = (size = "medium") => {
  const sizeMap = {
    small: 32,
    medium: 40,
    large: 56,
  };
  return sizeMap[size] || sizeMap.medium;
};
