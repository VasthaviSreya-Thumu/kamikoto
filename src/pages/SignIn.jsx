// SignIn.jsx
import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase/config";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useDispatch } from "react-redux";
import { setUser } from "../redux/userSlice";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { m } from "framer-motion";

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState({ google: false, github: false });
  const [recaptchaChecking, setRecaptchaChecking] = useState(false);
  const [captchaUnavailable, setCaptchaUnavailable] = useState(false);
  
  // reCAPTCHA v3 hook
  const { executeRecaptcha } = useGoogleReCaptcha();
  
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  // Get the redirect path from location state if exists
  const from = location.state?.from?.pathname || "/";

  // Verify the recaptcha token is valid
  const verifyRecaptchaToken = async () => {
    // If we've already determined reCAPTCHA is unavailable, bypass verification
    if (captchaUnavailable) {
      console.warn("reCAPTCHA verification bypassed due to unavailability");
      return true;
    }
    
    if (!executeRecaptcha) {
      console.warn("reCAPTCHA not available, proceeding without verification");
      setCaptchaUnavailable(true);
      return true;
    }

    setRecaptchaChecking(true);
    try {
      // Execute reCAPTCHA with action name
      const token = await executeRecaptcha('signin');
      
      // Here you would normally verify this token on your server
      // For now, we'll just log it and assume it's valid
      console.log("reCAPTCHA token:", token);
      
      // Return true if we got a token
      return !!token;
    } catch (error) {
      console.error("reCAPTCHA error:", error);
      toast.error("Could not verify you are human. Proceeding anyway.");
      setCaptchaUnavailable(true);
      return true; // Allow the user to continue despite the error
    } finally {
      setRecaptchaChecking(false);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();

    // Verify recaptcha first
    if (!await verifyRecaptchaToken()) {
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      dispatch(setUser(user));
      toast.success("Sign in successful!");
      // Redirect to intended destination or home
      navigate(from, { replace: true });
    } catch (error) {
      console.error("Error signing in:", error);
      toast.error(error.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignIn = async (e, providerType) => {
    // Prevent the default form submission
    e.preventDefault();
    e.stopPropagation();

    // Verify recaptcha first
    if (!await verifyRecaptchaToken()) {
      return;
    }

    // Set the appropriate loading state
    setSocialLoading({
      ...socialLoading,
      [providerType]: true
    });

    // Create provider based on type
    const provider = providerType === 'google' ? new GoogleAuthProvider() : new GithubAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        name: user.displayName || "",
        email: user.email,
        profilePic: user.photoURL || "",
      }, { merge: true });

      dispatch(setUser(user));
      toast.success("Sign in successful!");
      // Redirect to intended destination or home
      navigate(from, { replace: true });
    } catch (error) {
      console.error("Error with social sign in:", error);
      toast.error(error.message || "An error occurred.");
    } finally {
      // Reset loading state
      setSocialLoading({
        ...socialLoading,
        [providerType]: false
      });
    }
  };
  
  // Check if reCAPTCHA is available
  useEffect(() => {
    let captchaTimeout;
    
    if (!executeRecaptcha) {
      console.log("reCAPTCHA not yet available");
      // Set a timeout to bypass captcha if it doesn't load in 5 seconds
      captchaTimeout = setTimeout(() => {
        console.warn("reCAPTCHA failed to load after timeout, bypassing verification");
        setCaptchaUnavailable(true);
      }, 5000);
    }
    
    return () => {
      if (captchaTimeout) clearTimeout(captchaTimeout);
    };
  }, [executeRecaptcha]);

  return (
    <m.div
      initial={{ opacity: 0, y: 50 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.6, ease: "easeInOut" }} 
      className="container mx-auto px-4 py-8 bg-gray-50"
    >
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <form
          onSubmit={handleSignIn}
          className="w-full max-w-md bg-white p-8 rounded-lg shadow-md"
        >
          <h2 className="text-3xl font-semibold text-center mb-6">Sign In</h2>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full p-4 mb-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full p-4 mb-6 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          
          {/* Protected by reCAPTCHA v3 - No UI needed */}
          <div className="mb-4 text-center text-xs text-gray-500">
            {captchaUnavailable 
              ? "reCAPTCHA verification bypassed due to unavailability." 
              : " "}
          </div>
          
          <button
            type="submit"
            className={`w-full bg-blue-600 text-white py-2 rounded-lg font-semibold transition-all duration-200 ${loading || recaptchaChecking ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-700"}`}
            disabled={loading || recaptchaChecking}
          >
            {loading ? "Processing..." : recaptchaChecking ? "Verifying..." : "Sign In"}
          </button>
          
          <div className="mt-4">
            <button
              type="button"
              onClick={(e) => handleSocialSignIn(e, 'google')}
              className="w-full bg-red-500 text-white py-2 rounded-lg mb-2 hover:bg-red-600 transition duration-200"
              disabled={socialLoading.google || recaptchaChecking}
            >
              {socialLoading.google ? "Processing..." : "Sign in with Google"}
            </button>
            <button
              type="button"
              onClick={(e) => handleSocialSignIn(e, 'github')}
              className="w-full bg-gray-800 text-white py-2 rounded-lg mb-2 hover:bg-gray-900 transition duration-200"
              disabled={socialLoading.github || recaptchaChecking}
            >
              {socialLoading.github ? "Processing..." : "Sign in with Github"}
            </button>
          </div>
          <p className="mt-4 text-center text-gray-600">
            Don't have an account?{" "}
            <Link to="/signup" className="text-blue-600 hover:underline">
              Sign Up
            </Link>
          </p>
          <p className="mt-2 text-center text-gray-600">
            <Link to="/password-reset" className="text-blue-600 hover:underline">
              Forgot your password?
            </Link>
          </p>
        </form>
      </div>
    </m.div>
  );
}

export default SignIn;
