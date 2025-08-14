// src/App.jsx
import React, { useState, useEffect } from "react";
import { auth, db } from "./firebase"; 
import { onAuthStateChanged, signInAnonymously, signInWithCustomToken } from "firebase/auth";
import { collection, addDoc, query, onSnapshot, serverTimestamp, doc, updateDoc } from "firebase/firestore";

function App() {
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [storyKeywords, setStoryKeywords] = useState('');
  const [generatedStory, setGeneratedStory] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [stories, setStories] = useState([]);
  const [lastGeneratedStoryId, setLastGeneratedStoryId] = useState(null);
  const [showPastStories, setShowPastStories] = useState(false);

  // replace with your actual appId (or import from env)
  const appId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        setMessage(`Signed in as: ${user.uid}`);
      } else {
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
            setMessage("Signed in with custom token.");
          } else {
            await signInAnonymously(auth);
            setMessage("Signed in anonymously.");
          }
        } catch (error) {
          console.error("Error during sign-in:", error);
          setMessage(`Sign-in error: ${error.message}`);
        }
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  // Fetch stories in realtime
  useEffect(() => {
    if (isAuthReady && db && userId) {
      const storiesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/stories`);
      const q = query(storiesCollectionRef);

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedStories = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        fetchedStories.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
        setStories(fetchedStories);
      }, (error) => {
        console.error("Error fetching stories:", error);
        setMessage(`Error fetching stories: ${error.message}`);
      });

      return () => unsubscribe();
    }
  }, [db, userId, isAuthReady]);

  // Generate story
  const generateStory = async () => {
    if (!storyKeywords.trim()) {
      setMessage("Please enter some keywords for your story.");
      return;
    }
    if (!db || !userId) {
      setMessage("Firebase not initialized or user not authenticated.");
      return;
    }

    setIsLoading(true);
    setMessage("Generating your story...");
    setGeneratedStory("");
    setLastGeneratedStoryId(null);

    try {
      const cloudFunctionUrl = "https://asia-south1-storyteller-5a897.cloudfunctions.net/generate_story_function";
      const requestBody = { keywords: storyKeywords, userId: userId, appId: appId };

      const response = await fetch(cloudFunctionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const generatedText = data.story;

      setGeneratedStory(generatedText);
      setMessage("Story generated! Please provide feedback.");

      const storiesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/stories`);
      const newStoryDocRef = await addDoc(storiesCollectionRef, {
        userId,
        keywords: storyKeywords,
        story: generatedText,
        timestamp: serverTimestamp(),
        feedback: null,
      });
      setLastGeneratedStoryId(newStoryDocRef.id);
      setStoryKeywords("");
    } catch (error) {
      console.error("Error generating story:", error);
      setMessage(`Error: ${error.message}`);
      setGeneratedStory("Failed to generate story.");
    } finally {
      setIsLoading(false);
    }
  };

  // Feedback
  const submitFeedback = async (storyId, feedbackType) => {
    if (!db || !userId || !storyId) {
      setMessage("Firebase not initialized, user not authenticated, or story ID missing.");
      return;
    }
    setMessage(`Submitting feedback for story ${storyId}...`);
    try {
      const storyDocRef = doc(db, `artifacts/${appId}/users/${userId}/stories`, storyId);
      await updateDoc(storyDocRef, {
        feedback: { type: feedbackType, timestamp: serverTimestamp() },
      });
      setMessage(`Feedback '${feedbackType}' submitted!`);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      setMessage(`Error submitting feedback: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-200 via-pink-100 to-blue-200 p-6 font-inter text-gray-800">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-4xl font-extrabold text-center text-indigo-800 drop-shadow-lg">
          ✨ AI Story Generator
        </h1>

        {userId && (
          <div className="text-center text-sm bg-white/50 backdrop-blur-md p-3 rounded-lg shadow">
            Your User ID: <span className="font-semibold">{userId}</span>
          </div>
        )}

        <div className="bg-white/70 backdrop-blur-lg rounded-xl shadow-lg p-6 space-y-4">
          <label className="block text-lg font-medium text-gray-700">
            Enter Keywords or Themes:
          </label>
          <textarea
            rows="3"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 resize-none"
            placeholder="e.g., brave knight, enchanted forest, mysterious treasure"
            value={storyKeywords}
            onChange={(e) => setStoryKeywords(e.target.value)}
            disabled={isLoading}
          />
          <button
            onClick={generateStory}
            disabled={isLoading}
            className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition duration-300 ${
              isLoading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 shadow-md"
            }`}
          >
            {isLoading ? "Crafting your epic tale..." : "Generate Story"}
          </button>
        </div>

        {message && (
          <div className={`p-3 rounded-lg text-center shadow ${message.includes("Error") ? "bg-red-200 text-red-800" : "bg-green-200 text-green-800"}`}>
            {message}
          </div>
        )}

        {generatedStory && (
          <div className="bg-white/80 backdrop-blur-md p-6 rounded-xl shadow-inner space-y-4">
            <h2 className="text-2xl font-bold text-indigo-700">Your Story</h2>
            <p className="whitespace-pre-wrap">{generatedStory}</p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => submitFeedback(lastGeneratedStoryId, "loved")} className="py-2 px-4 bg-green-500 text-white rounded-lg">Loved it!</button>
              <button onClick={() => submitFeedback(lastGeneratedStoryId, "too_short")} className="py-2 px-4 bg-yellow-500 text-white rounded-lg">Too short</button>
              <button onClick={() => submitFeedback(lastGeneratedStoryId, "more_humor")} className="py-2 px-4 bg-blue-500 text-white rounded-lg">More humor</button>
              <button onClick={() => submitFeedback(lastGeneratedStoryId, "more_adventure")} className="py-2 px-4 bg-purple-500 text-white rounded-lg">More adventure</button>
              <button onClick={() => submitFeedback(lastGeneratedStoryId, "not_my_style")} className="py-2 px-4 bg-red-500 text-white rounded-lg">Not my style</button>
            </div>
          </div>
        )}

        <button
          onClick={() => setShowPastStories(!showPastStories)}
          className="w-full py-2 px-4 bg-white/70 rounded-lg shadow hover:bg-white/90"
        >
          {showPastStories ? "Hide Past Stories ▲" : "Show Past Stories ▼"}
        </button>

        {showPastStories && stories.length > 0 && (
          <div className="space-y-4">
            {stories.map((storyItem) => (
              <div key={storyItem.id} className="bg-white/60 backdrop-blur-lg p-4 rounded-lg shadow">
                <p className="text-sm text-gray-500 mb-1">
                  Keywords: <span className="font-semibold">{storyItem.keywords}</span>
                </p>
                <p className="whitespace-pre-wrap">{storyItem.story}</p>
                {storyItem.feedback && (
                  <p className="text-xs text-gray-600 mt-2">
                    Feedback: <span className="font-semibold">{storyItem.feedback.type}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
