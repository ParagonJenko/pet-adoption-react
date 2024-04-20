import axios from 'axios';

export const geoService = {
	async getGeocodePoint(city, country) {
		const service = process.env.GEOCODE_SOLUTION;

		if (service === 'mapbox') {
			console.log(service);
			const searchQuery = `${city}, ${country}`;
			const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
				searchQuery
			)}.json?access_token=${process.env.MAPBOX_ACCESS_TOKEN}`;
			try {
				const response = await axios.get(url);
				if (
					response.data.features.length > 0 &&
					response.data.features[0].geometry
				) {
					const coordinates = response.data.features[0].geometry.coordinates;
					return `(${coordinates[0]}, ${coordinates[1]})`;
				} else {
					return null; // Return null if no valid coordinates found
				}
			} catch (error) {
				console.error('Failed to fetch coordinates:', error);
				return null; // Return null in case of error
			}
		} else if (service === 'google') {
			console.log(service);
			const searchQuery = `${city}, ${country}`;
			const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
				searchQuery
			)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
			try {
				const response = await axios.get(url);
				if (response.data.status === 'OK') {
					const location = response.data.results[0].geometry.location;
					return `(${location.lng}, ${location.lat})`;
				} else {
					return null; // Return null if no valid coordinates found
				}
			} catch (error) {
				console.error('Failed to fetch coordinates:', error);
				return null; // Return null in case of error
			}
		} else {
			console.error('No service selected for getGeocodePoint');
			return null; // Return null if no service is selected
		}
	},
};

// export default geoService;
