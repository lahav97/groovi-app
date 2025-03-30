import { useState } from 'react';

const useLikeVideo = (videoId) => {
  const [likedVideos, setLikedVideos] = useState({});

  const isLiked = likedVideos[videoId];

  const toggleLike = (id) => {
    setLikedVideos((prevLikedVideos) => ({
      ...prevLikedVideos,
      [id]: !prevLikedVideos[id],
    }));
  };

  return { isLiked, toggleLike };
};

export default useLikeVideo;