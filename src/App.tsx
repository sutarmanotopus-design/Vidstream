import React, { useState, useEffect, useRef } from "react";
import { 
  Menu, 
  Search, 
  Video, 
  Bell, 
  User, 
  Home, 
  Compass, 
  PlaySquare, 
  Clock, 
  ThumbsUp, 
  ChevronDown, 
  MoreVertical,
  Upload,
  RefreshCw,
  X,
  Play
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface MediaData {
  id: number;
  type: 'video' | 'photo' | 'embed';
  filename?: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  embedUrl?: string;
  createdAt: string;
}

export default function App() {
  const [media, setMedia] = useState<MediaData[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MediaData | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentType, setCurrentType] = useState<'all' | 'video' | 'photo' | 'embed'>('all');
  const [uploadType, setUploadType] = useState<'video' | 'photo' | 'embed'>('video');
  const [isUploading, setIsUploading] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const fetchMedia = async () => {
    try {
      const url = currentType === 'all' ? "/api/media" : `/api/media?type=${currentType}`;
      const response = await fetch(url);
      const data = await response.json();
      setMedia(data);
    } catch (error) {
      console.error("Error fetching media:", error);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, [currentType]);

  const captureThumbnail = (videoFile: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = URL.createObjectURL(videoFile);
      video.onloadedmetadata = () => {
        video.currentTime = 1; // Capture at 1 second
      };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        }, 'image/jpeg', 0.8);
      };
      video.onerror = reject;
    });
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    const formData = new FormData(e.currentTarget);
    
    let endpoint = "/api/upload/video";
    if (uploadType === 'photo') endpoint = "/api/upload/photo";
    if (uploadType === 'embed') {
      const data = Object.fromEntries(formData.entries());
      try {
        const response = await fetch("/api/upload/embed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (response.ok) {
          setIsUploadModalOpen(false);
          fetchMedia();
        }
      } catch (error) {
        console.error("Error uploading embed:", error);
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // For video, capture thumbnail automatically
    if (uploadType === 'video') {
      const videoFile = formData.get('video') as File;
      if (videoFile) {
        try {
          const thumbnailBlob = await captureThumbnail(videoFile);
          formData.append('thumbnail', thumbnailBlob, 'thumbnail.jpg');
        } catch (error) {
          console.error("Error capturing thumbnail:", error);
        }
      }
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        setIsUploadModalOpen(false);
        fetchMedia();
      }
    } catch (error) {
      console.error("Error uploading media:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!id) return;
    
    // Close menu first to avoid UI glitches
    setMenuOpenId(null);

    const isConfirmed = window.confirm("Apakah Anda yakin ingin menghapus item ini? Tindakan ini tidak dapat dibatalkan.");
    if (!isConfirmed) return;

    try {
      const response = await fetch(`/api/media/${id}`, { method: "DELETE" });
      if (response.ok) {
        // If we deleted the currently playing media, go back to home
        if (selectedMedia && selectedMedia.id === id) {
          setSelectedMedia(null);
        }
        // Refresh the list
        await fetchMedia();
      } else {
        const error = await response.json();
        alert(`Gagal menghapus: ${error.error || 'Terjadi kesalahan'}`);
      }
    } catch (error) {
      console.error("Error deleting media:", error);
      alert("Terjadi kesalahan saat mencoba menghapus media.");
    }
  };

  const filteredMedia = media.filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [isGuideOpen, setIsGuideOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white font-sans">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-[#0f0f0f] flex items-center justify-between px-4 z-50 border-b border-white/5">
        <div className={`flex items-center gap-4 ${isMobileSearchOpen ? "hidden" : "flex"}`}>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-1 cursor-pointer" onClick={() => { setSelectedMedia(null); setCurrentType('all'); }}>
            <div className="bg-red-600 p-1 rounded-lg">
              <Play size={18} fill="white" />
            </div>
            <span className="text-xl font-bold tracking-tighter hidden xs:block">VidStream</span>
          </div>
        </div>

        <div className={`${isMobileSearchOpen ? "flex flex-1" : "hidden sm:flex"} flex-1 max-w-2xl px-4`}>
          <div className="flex items-center w-full gap-2">
            {isMobileSearchOpen && (
              <button 
                onClick={() => setIsMobileSearchOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors sm:hidden"
              >
                <X size={20} />
              </button>
            )}
            <div className="flex-1 flex items-center bg-[#121212] border border-white/10 rounded-full px-4 py-1.5 focus-within:border-blue-500">
              <Search size={18} className="text-gray-400 mr-2" />
              <input 
                type="text" 
                placeholder="Search" 
                className="bg-transparent w-full outline-none text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus={isMobileSearchOpen}
              />
            </div>
            <button className="hidden sm:block bg-white/10 px-5 py-1.5 rounded-r-full border-l-0 border border-white/10 hover:bg-white/20 transition-colors">
              <Search size={18} />
            </button>
          </div>
        </div>

        <div className={`flex items-center gap-1 sm:gap-2 ${isMobileSearchOpen ? "hidden" : "flex"}`}>
          <button 
            onClick={() => setIsMobileSearchOpen(true)}
            className="sm:hidden p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <Search size={22} />
          </button>
          <button 
            onClick={() => setIsUploadModalOpen(true)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <Video size={24} />
          </button>
          <button 
            onClick={() => {
              setIsSyncing(true);
              fetch("/api/sync", { method: "POST" }).then(() => {
                fetchMedia();
                setIsSyncing(false);
              });
            }}
            disabled={isSyncing}
            className={`p-2 hover:bg-white/10 rounded-full transition-colors ${isSyncing ? "animate-spin" : ""}`}
          >
            <RefreshCw size={24} />
          </button>
          <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <Bell size={24} />
          </button>
        </div>
      </header>

      <div className="flex pt-14 h-[calc(100vh-56px)]">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed md:relative top-14 bottom-0 left-0 z-40
        ${isSidebarOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full md:w-20 md:translate-x-0"} 
        bg-[#0f0f0f] overflow-y-auto transition-all duration-300 border-r border-white/5
      `}>
        <div className="p-2">
          <SidebarItem icon={<Home size={22} />} label="All Media" active={currentType === 'all'} onClick={() => { setCurrentType('all'); setSelectedMedia(null); if (window.innerWidth < 768) setIsSidebarOpen(false); }} isOpen={isSidebarOpen || window.innerWidth < 768} />
          <SidebarItem icon={<PlaySquare size={22} />} label="Videos" active={currentType === 'video'} onClick={() => { setCurrentType('video'); setSelectedMedia(null); if (window.innerWidth < 768) setIsSidebarOpen(false); }} isOpen={isSidebarOpen || window.innerWidth < 768} />
          <SidebarItem icon={<Compass size={22} />} label="Photos" active={currentType === 'photo'} onClick={() => { setCurrentType('photo'); setSelectedMedia(null); if (window.innerWidth < 768) setIsSidebarOpen(false); }} isOpen={isSidebarOpen || window.innerWidth < 768} />
          <SidebarItem icon={<Video size={22} />} label="Embeds" active={currentType === 'embed'} onClick={() => { setCurrentType('embed'); setSelectedMedia(null); if (window.innerWidth < 768) setIsSidebarOpen(false); }} isOpen={isSidebarOpen || window.innerWidth < 768} />
          <div className="h-px bg-white/10 my-3 mx-2" />
          <SidebarItem icon={<RefreshCw size={22} />} label="Deployment Guide" onClick={() => { setIsGuideOpen(true); if (window.innerWidth < 768) setIsSidebarOpen(false); }} isOpen={isSidebarOpen || window.innerWidth < 768} />
        </div>
      </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-[#0f0f0f] p-3 sm:p-6">
          {selectedMedia ? (
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="lg:col-span-2">
                <div className="aspect-video bg-black rounded-lg sm:rounded-xl overflow-hidden shadow-2xl flex items-center justify-center">
                  {selectedMedia.type === 'video' && (
                    <video 
                      src={`/uploads/${selectedMedia.filename}`} 
                      controls 
                      autoPlay 
                      className="w-full h-full"
                    />
                  )}
                  {selectedMedia.type === 'photo' && (
                    <img 
                      src={`/uploads/${selectedMedia.filename}`} 
                      alt={selectedMedia.title}
                      className="max-w-full max-h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  {selectedMedia.type === 'embed' && (
                    <iframe 
                      src={selectedMedia.embedUrl}
                      className="w-full h-full border-0"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  )}
                </div>
                <div className="mt-4">
                  <h1 className="text-xl font-bold">{selectedMedia.title}</h1>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full" />
                      <div>
                        <p className="font-semibold">VidStream Creator</p>
                        <p className="text-xs text-gray-400 capitalize">{selectedMedia.type} Content</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-3 sm:mt-0">
                      <div className="flex items-center bg-white/10 rounded-full overflow-hidden">
                        <button className="flex items-center gap-2 px-3 sm:px-4 py-2 hover:bg-white/10 border-r border-white/10 text-sm">
                          <ThumbsUp size={18} /> <span className="hidden xs:inline">Like</span>
                        </button>
                        <button className="px-3 sm:px-4 py-2 hover:bg-white/10">
                          <ThumbsUp size={18} className="rotate-180" />
                        </button>
                      </div>
                      <button className="bg-white/10 px-4 py-2 rounded-full hover:bg-white/20 transition-colors text-sm">Share</button>
                      <div className="relative">
                        <button 
                          onClick={() => setMenuOpenId(menuOpenId === selectedMedia.id ? null : selectedMedia.id)}
                          className="bg-white/10 p-2.5 rounded-full hover:bg-white/20 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                        >
                          <MoreVertical size={20} />
                        </button>
                        
                        <AnimatePresence>
                          {menuOpenId === selectedMedia.id && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -10 }}
                              className="absolute right-0 mt-2 w-32 bg-[#282828] rounded-lg shadow-xl border border-white/10 z-10 overflow-hidden"
                            >
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(selectedMedia.id);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-white/10 transition-colors flex items-center gap-2"
                              >
                                <X size={14} /> Delete
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 bg-white/10 p-4 rounded-xl text-sm">
                    <p className="font-bold">{new Date(selectedMedia.createdAt).toLocaleDateString()}</p>
                    <p className="mt-2 whitespace-pre-wrap">{selectedMedia.description}</p>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-1">
                <h2 className="font-bold mb-4">Related Content</h2>
                <div className="space-y-4">
                  {media.filter(m => m.id !== selectedMedia.id).slice(0, 10).map(item => (
                    <div 
                      key={item.id} 
                      className="flex gap-2 cursor-pointer group"
                      onClick={() => setSelectedMedia(item)}
                    >
                      <div className="relative w-32 sm:w-40 aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
                        <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute bottom-1 right-1 bg-black/80 text-[10px] px-1 rounded uppercase">{item.type}</div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold line-clamp-2 leading-tight group-hover:text-blue-400 transition-colors">{item.title}</h3>
                        <p className="text-xs text-gray-400 mt-1 capitalize">{item.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
              {filteredMedia.map((item) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={item.id} 
                  className="cursor-pointer group"
                  onClick={() => setSelectedMedia(item)}
                >
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-white/5 mb-3">
                    <img 
                      src={item.thumbnailUrl} 
                      alt={item.title} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute bottom-2 right-2 bg-black/80 text-xs px-1.5 py-0.5 rounded font-medium uppercase">
                      {item.type}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-bold line-clamp-2 leading-tight group-hover:text-blue-400 transition-colors">{item.title}</h3>
                      <p className="text-sm text-gray-400 mt-1 capitalize">{item.type} • {new Date(item.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="relative">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === item.id ? null : item.id);
                        }}
                        className="p-2.5 hover:bg-white/10 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >
                        <MoreVertical size={20} />
                      </button>
                      
                      <AnimatePresence>
                        {menuOpenId === item.id && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            className="absolute right-0 mt-2 w-32 bg-[#282828] rounded-lg shadow-xl border border-white/10 z-10 overflow-hidden"
                          >
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(item.id);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-white/10 transition-colors flex items-center gap-2"
                            >
                              <X size={14} /> Delete
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              ))}
              {filteredMedia.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
                  <Video size={64} className="mb-4 opacity-20" />
                  <p className="text-xl font-medium">No content found</p>
                  <p className="text-sm mt-1">Try uploading some media or syncing your folder.</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#282828] w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="text-xl font-bold">Add Content</h2>
                <button 
                  onClick={() => setIsUploadModalOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex border-b border-white/10">
                <button 
                  onClick={() => setUploadType('video')}
                  className={`flex-1 py-3 text-sm font-bold transition-colors ${uploadType === 'video' ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
                >
                  VIDEO
                </button>
                <button 
                  onClick={() => setUploadType('photo')}
                  className={`flex-1 py-3 text-sm font-bold transition-colors ${uploadType === 'photo' ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
                >
                  PHOTO
                </button>
                <button 
                  onClick={() => setUploadType('embed')}
                  className={`flex-1 py-3 text-sm font-bold transition-colors ${uploadType === 'embed' ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
                >
                  EMBED
                </button>
              </div>

              <form onSubmit={handleUpload} className="p-8 flex flex-col items-center">
                {uploadType === 'video' && (
                  <>
                    <div className="w-24 h-24 bg-[#1f1f1f] rounded-full flex items-center justify-center mb-6 border-2 border-dashed border-white/10">
                      <Video size={36} className="text-gray-400" />
                    </div>
                    <p className="text-lg font-medium mb-1">Upload Video</p>
                    <p className="text-sm text-gray-400 mb-8 text-center">Thumbnail will be captured automatically.</p>
                    <label className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-full font-bold cursor-pointer transition-colors disabled:opacity-50">
                      {isUploading ? "UPLOADING..." : "SELECT VIDEO"}
                      <input type="file" name="video" accept="video/*" className="hidden" disabled={isUploading} onChange={(e) => {
                        if (e.target.files?.length) {
                          const form = e.target.closest('form');
                          if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                        }
                      }} />
                    </label>
                  </>
                )}

                {uploadType === 'photo' && (
                  <>
                    <div className="w-24 h-24 bg-[#1f1f1f] rounded-full flex items-center justify-center mb-6 border-2 border-dashed border-white/10">
                      <Compass size={36} className="text-gray-400" />
                    </div>
                    <p className="text-lg font-medium mb-1">Upload Photo</p>
                    <p className="text-sm text-gray-400 mb-8">Select an image file.</p>
                    <label className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-full font-bold cursor-pointer transition-colors disabled:opacity-50">
                      {isUploading ? "UPLOADING..." : "SELECT PHOTO"}
                      <input type="file" name="photo" accept="image/*" className="hidden" disabled={isUploading} onChange={(e) => {
                        if (e.target.files?.length) {
                          const form = e.target.closest('form');
                          if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                        }
                      }} />
                    </label>
                  </>
                )}

                {uploadType === 'embed' && (
                  <div className="w-full space-y-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-bold text-gray-400">Embed Code or URL</label>
                      <textarea 
                        name="url" 
                        placeholder='Paste <embed> code or YouTube URL here...' 
                        className="bg-[#121212] border border-white/10 rounded-xl p-3 outline-none focus:border-blue-500 h-32 resize-none"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-bold text-gray-400">Title (Optional)</label>
                      <input 
                        type="text" 
                        name="title" 
                        placeholder="Enter a custom title" 
                        className="bg-[#121212] border border-white/10 rounded-xl p-3 outline-none focus:border-blue-500"
                      />
                    </div>
                    <button 
                      type="submit" 
                      disabled={isUploading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-full font-bold transition-colors disabled:opacity-50"
                    >
                      {isUploading ? "ADDING..." : "ADD EMBED CONTENT"}
                    </button>
                  </div>
                )}
                
                <p className="mt-8 text-[10px] text-gray-500 text-center max-w-md">
                  By submitting content to VidStream, you acknowledge that you agree to VidStream's Terms of Service and Community Guidelines.
                </p>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Deployment Guide Modal */}
      <AnimatePresence>
        {isGuideOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#282828] w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="text-xl font-bold">Deployment Guide (Debian + Nginx)</h2>
                <button 
                  onClick={() => setIsGuideOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto text-sm space-y-6">
                <section>
                  <h3 className="text-lg font-bold text-blue-400 mb-2">1. Install Dependencies</h3>
                  <pre className="bg-black/50 p-3 rounded-lg overflow-x-auto">
                    <code>{`sudo apt update
sudo apt install nginx nodejs npm git sqlite3`}</code>
                  </pre>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-blue-400 mb-2">2. Setup Application</h3>
                  <pre className="bg-black/50 p-3 rounded-lg overflow-x-auto">
                    <code>{`git clone <your-repo-url> vidstream
cd vidstream
npm install
npm run build`}</code>
                  </pre>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-blue-400 mb-2">3. Configure Nginx</h3>
                  <p className="mb-2">Create a new config file: <code>/etc/nginx/sites-available/vidstream</code></p>
                  <pre className="bg-black/50 p-3 rounded-lg overflow-x-auto">
                    <code>{`server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Increase upload limit for videos
    client_max_body_size 500M;
}`}</code>
                  </pre>
                  <p className="mt-2 text-xs text-gray-400">Enable it: <code>sudo ln -s /etc/nginx/sites-available/vidstream /etc/nginx/sites-enabled/</code></p>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-blue-400 mb-2">4. Domain & SSL</h3>
                  <p>To use a domain, point your A record to your server's IP. Then use Certbot for SSL:</p>
                  <pre className="bg-black/50 p-3 rounded-lg overflow-x-auto">
                    <code>{`sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com`}</code>
                  </pre>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-blue-400 mb-2">5. Keep it running</h3>
                  <p>Use PM2 to keep the server running in the background:</p>
                  <pre className="bg-black/50 p-3 rounded-lg overflow-x-auto">
                    <code>{`sudo npm install -g pm2
pm2 start server.ts --interpreter tsx
pm2 save
pm2 startup`}</code>
                  </pre>
                </section>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SidebarItem({ icon, label, active = false, onClick, isOpen }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void, isOpen: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-6 px-3 py-2.5 rounded-xl transition-colors ${active ? "bg-white/10 font-bold" : "hover:bg-white/10"}`}
    >
      <div className={active ? "text-white" : "text-gray-200"}>{icon}</div>
      {isOpen && <span className="text-sm">{label}</span>}
    </button>
  );
}
