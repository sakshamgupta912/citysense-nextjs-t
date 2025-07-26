import { Loader } from '@googlemaps/js-api-loader';

let loaderPromise: Promise<typeof google> | null = null;

const getLoader = () => {
  if (!loaderPromise) {
    // This code runs only ONCE, the first time getLoader() is called.
    const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyC6yIDLEqZBF-VafsvyQacUqFo6W36vlVQ';
    
    if (!googleMapsApiKey) {
      // If the API key is missing, return a rejected promise.
      return Promise.reject(new Error("Google Maps API key is missing."));
    }

    const loader = new Loader({
      apiKey: googleMapsApiKey,
      version: "weekly",
      libraries: ["visualization", "marker", "places"],
    });

    // Store the promise. Future calls will return this same promise.
    loaderPromise = loader.load().then(() => {
        return window.google;
    });
  }

  return loaderPromise;
};

export default getLoader;