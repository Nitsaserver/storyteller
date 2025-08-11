// src/App.jsx
import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, onSnapshot, serverTimestamp, doc, updateDoc } from 'firebase/firestore';

// Global variables provided by the Canvas environment
// These are automatically injected by the Canvas runtime, so no need to replace them manually.
const appId = typeof __app_id !== 'undefined' ? __app_id : '1:258131252421:web:b54c7ed6a504661f6accac';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "REMOVEDREMOVED",
  authDomain: "storyteller-5a897.firebaseapp.com",
  projectId: "storyteller-5a897",
  storageBucket: "storyteller-5a897.firebasestorage.app",
  messagingSenderId: "258131252421",
  appId: "1:258131252421:web:b54c7ed6a504661f6accac",
  // measurementId: "YOUR_MEASUREMENT_ID" // Include if you enabled Analytics
};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

function App() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false); // To ensure Firestore operations wait for auth
  const [storyKeywords, setStoryKeywords] = useState('');
  const [generatedStory, setGeneratedStory] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [stories, setStories] = useState([]);
  const [lastGeneratedStoryId, setLastGeneratedStoryId] = useState(null); // To link feedback to the latest story

  // Initialize Firebase and set up authentication listener
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setDb(firestore);
      setAuth(firebaseAuth);

      // Listen for authentication state changes
      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          setUserId(user.uid);
          setMessage(`Signed in as: ${user.uid}`);
        } else {
          // If no user, try to sign in with custom token or anonymously
          try {
            if (initialAuthToken) {
              await signInWithCustomToken(firebaseAuth, initialAuthToken);
              setMessage('Signed in with custom token.');
            } else {
              await signInAnonymously(firebaseAuth);
              setMessage('Signed in anonymously.');
            }
          } catch (error) {
            console.error('Error during sign-in:', error);
            setMessage(`Sign-in error: ${error.message}`);
          }
        }
        setIsAuthReady(true); // Auth state is now known
      });

      // Cleanup subscription on unmount
      return () => unsubscribe();
    } catch (error) {
      console.error("Error initializing Firebase:", error);
      setMessage(`Firebase Init Error: ${error.message}`);
    }
  }, []);

  // Fetch stories when auth is ready and db/userId are available
  useEffect(() => {
    if (isAuthReady && db && userId) {
      const storiesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/stories`);
      // Note: orderBy is commented out as per instructions to avoid potential index issues.
      // Data will be sorted client-side if needed.
      const q = query(storiesCollectionRef); // , orderBy('timestamp', 'desc')

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedStories = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        // Sort client-side by timestamp in descending order
        fetchedStories.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
        setStories(fetchedStories);
      }, (error) => {
        console.error("Error fetching stories:", error);
        setMessage(`Error fetching stories: ${error.message}`);
      });

      return () => unsubscribe(); // Clean up listener
    }
  }, [db, userId, isAuthReady]);

  // Function to simulate LLM story generation
  const generateStory = async () => {
    if (!storyKeywords.trim()) {
      setMessage('Please enter some keywords for your story.');
      return;
    }
    if (!db || !userId) {
      setMessage('Firebase not initialized or user not authenticated.');
      return;
    }

    setIsLoading(true);
    setMessage('Generating your story...');
    setGeneratedStory('');
    setLastGeneratedStoryId(null);

    try {
      // --- SIMULATED LLM CALL ---
      // In a real application, you would make a fetch call to your Python Cloud Function here.
      // The Cloud Function would:
      // 1. Take `storyKeywords` and potentially `user_preferences` from Firestore.
      // 2. Call the Gemini API to generate the story.
      // 3. Return the generated story.

      // For this demonstration, we'll simulate a delay and a generic story.
      // Replace this with an actual API call to your Cloud Function:
      // const response = await fetch('YOUR_CLOUD_FUNCTION_URL/generate_story', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ keywords: storyKeywords, userId: userId })
      // });
      // const data = await response.json();
      // const generatedText = data.story;

      await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate network delay
      const simulatedStory = `In a land far, far away, where ${storyKeywords.toLowerCase()} roamed free, a tale began. A brave hero embarked on a perilous journey, facing mystical creatures and overcoming ancient curses. The sun set, casting long shadows, as the hero finally reached their destination, a shimmering castle atop a cloud. What adventures await them next? This story was inspired by your keywords.`;
      // --- END SIMULATED LLM CALL ---

      setGeneratedStory(simulatedStory);
      setMessage('Story generated! Please provide feedback.');

      // Save the generated story to Firestore
      const storiesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/stories`);
      const newStoryDocRef = await addDoc(storiesCollectionRef, {
        userId: userId,
        keywords: storyKeywords,
        story: simulatedStory,
        timestamp: serverTimestamp(),
        feedback: null // Initialize feedback as null
      });
      setLastGeneratedStoryId(newStoryDocRef.id); // Store ID for immediate feedback

      setStoryKeywords(''); // Clear input after submission

    } catch (error) {
      console.error('Error generating story:', error);
      setMessage(`Error: ${error.message}. Check console for details.`);
      setGeneratedStory('Failed to generate story.');
    } finally {
      setIsLoading(false);
    }
  };

  const submitFeedback = async (storyId, feedbackType) => { // Removed feedbackText from signature as it's not used
    if (!db || !userId || !storyId) {
      setMessage('Firebase not initialized, user not authenticated, or story ID missing.');
      return;
    }

    setMessage(`Submitting feedback for story ${storyId}...`);
    try {
      // Get a reference to the specific document to update
      const storyDocRef = doc(db, `artifacts/${appId}/users/${userId}/stories`, storyId);

      // Update the 'feedback' field with an object containing type and timestamp
      await updateDoc(storyDocRef, {
        feedback: { // This will replace the 'feedback: null' or previous feedback object
          type: feedbackType,
          timestamp: serverTimestamp() // This will be a Firestore Timestamp
        }
      });
      setMessage(`Feedback '${feedbackType}' submitted!`);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setMessage(`Error submitting feedback: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 to-purple-100 p-4 font-inter text-gray-800 flex flex-col items-center">
      <div className="max-w-3xl w-full bg-white rounded-xl shadow-lg p-6 md:p-8 space-y-6">
        <h1 className="text-4xl font-extrabold text-center text-indigo-700 mb-6">
          AI Story Generator
        </h1>

        {userId && (
          <div className="text-center text-sm text-gray-600 mb-4 p-2 bg-indigo-50 rounded-lg">
            Your User ID: <span className="font-semibold break-all">{userId}</span>
          </div>
        )}

        <div className="space-y-4">
          <label htmlFor="storyKeywords" className="block text-lg font-medium text-gray-700">
            Enter Keywords or Themes (e.g., "brave knight, mischievous dragon, magical sword"):
          </label>
          <input
            type="text"
            id="storyKeywords"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition duration-200"
            placeholder="e.g., space adventure, lost robot, ancient ruins"
            value={storyKeywords}
            onChange={(e) => setStoryKeywords(e.target.value)}
            disabled={isLoading}
          />
          <button
            onClick={generateStory}
            className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition duration-300 ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-md hover:shadow-lg'
            }`}
            disabled={isLoading}
          >
            {isLoading ? 'Generating...' : 'Generate Story'}
          </button>
        </div>

        {message && (
          <div className={`p-3 rounded-lg text-center ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message}
          </div>
        )}

        {generatedStory && (
          <div className="bg-indigo-50 p-6 rounded-xl shadow-inner space-y-4">
            <h2 className="text-2xl font-bold text-indigo-700">Your Story:</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{generatedStory}</p>
            <div className="flex flex-wrap justify-center gap-3 mt-4">
              <button
                onClick={() => submitFeedback(lastGeneratedStoryId, 'loved')}
                className="py-2 px-4 bg-green-500 text-white rounded-lg hover:bg-green-600 transition duration-200 shadow-sm"
              >
                💖 Loved it!
              </button>
              <button
                onClick={() => submitFeedback(lastGeneratedStoryId, 'too_short')}
                className="py-2 px-4 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition duration-200 shadow-sm"
              >
                📏 Too short
              </button>
              <button
                onClick={() => submitFeedback(lastGeneratedStoryId, 'more_humor')}
                className="py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-200 shadow-sm"
              >
                😂 More humor
              </button>
              <button
                onClick={() => submitFeedback(lastGeneratedStoryId, 'more_adventure')}
                className="py-2 px-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition duration-200 shadow-sm"
              >
                ⚔️ More adventure
              </button>
              <button
                onClick={() => submitFeedback(lastGeneratedStoryId, 'not_my_style')}
                className="py-2 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 transition duration-200 shadow-sm"
              >
                ❌ Not my style
              </button>
            </div>
          </div>
        )}

        {stories.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h2 className="text-2xl font-bold text-indigo-700 mb-4">Your Past Stories:</h2>
            <div className="space-y-4">
              {stories.map((storyItem) => (
                <div key={storyItem.id} className="bg-gray-50 p-4 rounded-lg shadow-sm">
                  <p className="text-sm text-gray-500 mb-1">
                    Keywords: <span className="font-semibold">{storyItem.keywords}</span>
                  </p>
                  {storyItem.feedback && storyItem.feedback.type && ( // Ensure feedback.type exists
                    <p className="text-xs text-gray-600 mt-2">
                      Feedback: <span className="font-semibold">{storyItem.feedback.type}</span>
                      {storyItem.feedback.text && `: "${storyItem.feedback.text}"`} {/* Keep this line for text feedback */}
                      {storyItem.feedback.timestamp && ` at ${new Date(storyItem.feedback.timestamp.toDate ? storyItem.feedback.timestamp.toDate() : storyItem.feedback.timestamp).toLocaleString()}`}
                    </p>
              )}
                  
                  {!storyItem.feedback && (
                    <div className="flex flex-wrap gap-2 mt-2">
                        <button
                            onClick={() => submitFeedback(storyItem.id, 'loved')}
                            className="text-xs py-1 px-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition duration-150"
                        >
                            💖
                        </button>
                        <button
                            onClick={() => submitFeedback(storyItem.id, 'too_short')}
                            className="text-xs py-1 px-2 bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200 transition duration-150"
                        >
                            📏
                        </button>
                        <button
                            onClick={() => submitFeedback(storyItem.id, 'more_humor')}
                            className="text-xs py-1 px-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition duration-150"
                        >
                            😂
                        </button>
                        <button
                            onClick={() => submitFeedback(storyItem.id, 'more_adventure')}
                            className="text-xs py-1 px-2 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition duration-150"
                        >
                            ⚔️
                        </button>
                        <button
                            onClick={() => submitFeedback(storyItem.id, 'not_my_style')}
                            className="text-xs py-1 px-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition duration-150"
                        >
                            ❌
                        </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;