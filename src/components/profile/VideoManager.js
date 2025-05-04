import React from 'react';
import { View, Image, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList from 'react-native-draggable-flatlist';

const VideoManager = ({
  videos = [],
  setVideos,
  videoThumbnails = [],
  setVideoThumbnails,
  videoUrls = [],
  setVideoUrls,
  onDelete
}) => {
  const moveVideo = (from, to) => {
    if (to < 0 || to >= videos.length) return;
    const updatedVideos = [...videos];
    const updatedThumbs = [...videoThumbnails];
    const updatedUrls = [...videoUrls];

    [updatedVideos[from], updatedVideos[to]] = [updatedVideos[to], updatedVideos[from]];
    [updatedThumbs[from], updatedThumbs[to]] = [updatedThumbs[to], updatedThumbs[from]];
    [updatedUrls[from], updatedUrls[to]] = [updatedUrls[to], updatedUrls[from]];

    setVideos(updatedVideos);
    setVideoThumbnails(updatedThumbs);
    setVideoUrls(updatedUrls);
  };

  const handleDelete = (index) => {
    const updatedVideos = [...videos];
    const updatedThumbs = [...videoThumbnails];
    const updatedUrls = [...videoUrls];

    updatedVideos.splice(index, 1);
    updatedThumbs.splice(index, 1);
    updatedUrls.splice(index, 1);

    setVideos(updatedVideos);
    setVideoThumbnails(updatedThumbs);
    setVideoUrls(updatedUrls);

    if (onDelete) onDelete(index);
  };

  return (
    <DraggableFlatList
      data={videos}
      horizontal
      keyExtractor={(item) => item.id}
      onDragEnd={({ data }) => {
        setVideos(data);
        setVideoThumbnails(data.map(v => v.thumbnail));
        const newOrder = data.map(v => {
          const index = videos.findIndex(old => old.uri === v.uri);
          return videoUrls[index] || null;
        });
        setVideoUrls(newOrder);
      }}
      renderItem={({ item, index, drag }) => (
        <TouchableOpacity onLongPress={drag} style={{ marginRight: 10 }}>
          <View style={{ position: 'relative', alignItems: 'center' }}>
            <Image
              source={{ uri: item.thumbnail }}
              style={{ width: 70, height: 100, borderRadius: 10, backgroundColor: '#000' }}
            />
            <View style={{ flexDirection: 'row', marginTop: 4, gap: 8 }}>
              <TouchableOpacity onPress={() => moveVideo(index, index - 1)}>
                <Ionicons name="arrow-back-circle" size={24} color="gray" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(index)}>
                <Ionicons name="trash-bin" size={24} color="red" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => moveVideo(index, index + 1)}>
                <Ionicons name="arrow-forward-circle" size={24} color="gray" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      )}
    />
  );
};

export default VideoManager;
