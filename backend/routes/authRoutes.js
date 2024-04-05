// Import necessary modules and files.
import express from 'express'; // For routing.
import bcrypt from 'bcryptjs'; // For hashing passwords.
import jwt from 'jsonwebtoken'; // For creating JSON Web Tokens.
import User from '../models/User.js'; // User model for interacting with the database.
import Rescue from '../models/Rescue.js';
// Middleware for authentication and admin checks.
import authenticateToken from '../middleware/authenticateToken.js';
import checkAdmin from '../middleware/checkAdmin.js';
// Utilities for generating tokens and sending emails.
import handlePasswordReset from '../utils/handleResetPassword.js';
// Validation middleware for request bodies.
import {
	validateRequest,
	registerSchema,
	loginSchema,
	updateDetailsSchema,
	resetPasswordSchema,
	forgotPasswordSchema,
} from '../middleware/joiValidateSchema.js';

import Sentry from '@sentry/node'; // Assuming Sentry is already imported and initialized elsewhere
import LoggerUtil from '../utils/Logger.js';

// TEMP
import mongoose from 'mongoose';
import { generateResetToken } from '../utils/tokenGenerator.js';
import { sendEmailVerificationEmail } from '../services/emailService.js';

export default function createAuthRoutes({ tokenGenerator, emailService }) {
	const router = express.Router();
	const logger = new LoggerUtil('auth-service').getLogger(); // Initialize logger for auth-service

	/**
	 * Route handler for user registration. Validates the request body against the registerSchema,
	 * checks for existing users with the same email, hashes the password, and creates a new user in the database.
	 * Responds with a 201 status code and a success message if the user is created successfully.
	 * On failure, such as if the user already exists or there's an error during user creation, responds with an appropriate error message and status code.
	 */
	router.post(
		'/register',
		validateRequest(registerSchema),
		async (req, res) => {
			const { email, password, firstName } = req.body;
			try {
				// Check if user already exists.
				const existingUser = await User.findOne({ email });
				if (existingUser) {
					logger.warn(`Error existing user: ${email}`);
					return res.status(409).json({
						message: 'User already exists - please try login or reset password',
					});
				}
				// Hash the password and create a new user.
				const hashedPassword = await bcrypt.hash(password, 12);
				const verificationToken = await generateResetToken(); // Token generation

				const user = await User.create({
					email,
					password: hashedPassword,
					firstName,
					emailVerified: false,
					verificationToken,
				});
				logger.info(`New user registered: ${user._id}`);

				const FRONTEND_BASE_URL =
					process.env.FRONTEND_BASE_URL || 'http://localhost:5173';
				const verificationURL = `${FRONTEND_BASE_URL}/verify-email?token=${verificationToken}`;

				await sendEmailVerificationEmail(email, verificationURL);
				logger.info(`Verification email sent to: ${email}`);

				res.status(201).json({ message: 'User created!', userId: user._id });
			} catch (error) {
				logger.error(`Error creating user: ${error}`);
				Sentry.captureException(error);
				res.status(500).json({ message: 'Creating user failed.' });
			}
		}
	);

	router.get('/verify-email', async (req, res) => {
		const { token } = req.query;
		const logger = new LoggerUtil('auth-service').getLogger();
		try {
			const user = await User.findOne({
				verificationToken: token,
				emailVerified: false,
			});
			if (!user) {
				logger.warn(`Invalid or expired email verification token: ${token}`);
				return res.status(400).json({ message: 'Invalid or expired token' });
			}

			user.emailVerified = true;
			user.verificationToken = undefined; // Clear the verification token
			await user.save();

			logger.info(`Email verified for user: ${user._id}`);
			res.status(200).json({ message: 'Email verified successfully' });
		} catch (error) {
			logger.error(`Error verifying email: ${error}`);
			Sentry.captureException(error);
			res.status(500).json({ message: 'Email verification failed.' });
		}
	});

	/**
	 * Route handler for user login. Validates the request body against the loginSchema,
	 * verifies the user's email and password, generates a JWT token, and sends it as a HttpOnly cookie.
	 * Responds with a 200 status code, the user ID, and admin status on successful login.
	 * On failure, such as if the email or password is incorrect, or if there's an error during the process, responds with an appropriate error message and status code.
	 */

	router.post('/login', validateRequest(loginSchema), async (req, res) => {
		const { email, password } = req.body;
		try {
			// Check if the user exists
			const user = await User.findOne({ email });
			if (!user) {
				logger.info(`Login attempt failed: No user found with email ${email}`);
				return res.status(401).json({
					message: 'Email does not exist or password is not correct.',
				});
			}

			// Check if the password is correct
			if (!(await bcrypt.compare(password, user.password))) {
				logger.info(`Login attempt failed: Invalid credentials for ${email}`);
				return res.status(401).json({
					message: 'Email does not exist or password is not correct.',
				});
			}

			// Check if the user's email is verified
			if (!user.emailVerified) {
				logger.info(`Login attempt failed: Email not verified for ${email}`);
				return res.status(403).json({
					message:
						'Email is not verified. Please verify your email before logging in.',
				});
			}

			if (user.resetTokenForceFlag) {
				logger.warn(`Reset password required for: ${email}`);
				await handlePasswordReset(user);
				return res.status(403).json({
					message:
						'Password reset required. Please check your email to reset your password.',
				});
			}

			// Generate a token and send it as a HttpOnly cookie
			const token = jwt.sign(
				{ userId: user._id, isAdmin: user.isAdmin },
				process.env.SECRET_KEY,
				{ expiresIn: '1h' }
			);
			logger.info(`User logged in: ${user._id}`);
			res.cookie('token', token, {
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'strict',
				maxAge: 3600000,
			});
			res.status(200).json({ userId: user._id, isAdmin: user.isAdmin });
		} catch (error) {
			logger.error(`Error logging in user: ${error}`);
			Sentry.captureException(error);
			res.status(500).json({ message: 'Logging in failed.' });
		}
	});

	router.get('/validate-session', authenticateToken, async (req, res) => {
		// Assuming you have a middleware that sets req.user if the token is valid
		if (!req.user) {
			return res.status(401).json({ message: 'Invalid or expired token.' });
		}

		// Fetch additional user details if necessary
		const userDetails = await User.findById(req.user.userId).select(
			'-password'
		);
		if (!userDetails) {
			return res.status(404).json({ message: 'User not found.' });
		}

		res.status(200).json({
			userId: userDetails._id,
			isAdmin: userDetails.isAdmin,
		});
	});

	/**
	 * Route handler for updating user details. Requires authentication.
	 * Validates the request body against the updateDetailsSchema, allows the authenticated user to update their own details like email, password, and firstName.
	 * Responds with a 200 status code and a success message upon successful update.
	 * On failure, such as if the user is not found or there's an error during the update process, responds with an appropriate error message and status code.
	 */

	router.put(
		'/details',
		authenticateToken,
		validateRequest(updateDetailsSchema),
		async (req, res) => {
			const { email, password, firstName } = req.body;
			const userId = req.user.userId; // Extracting userId for logging purposes
			logger.info(`Updating user details for userId: ${userId}`); // Log the start of the process

			try {
				const user = await User.findById(userId);
				if (!user) {
					logger.warn(`User not found for userId: ${userId}`); // Log when user is not found
					return res.status(404).json({ message: 'User not found.' });
				}

				// Log the fields that are being updated
				let fieldsUpdated = [];
				if (firstName) {
					user.firstName = firstName;
					fieldsUpdated.push('firstName');
				}
				if (email) {
					user.email = email;
					fieldsUpdated.push('email');
				}
				if (password) {
					const hashedPassword = await bcrypt.hash(password, 12);
					user.password = hashedPassword;
					fieldsUpdated.push('password');
				}
				await user.save();

				// Log successful update, including which fields were updated
				logger.info(
					`User details updated for userId: ${userId}. Fields updated: ${fieldsUpdated.join(
						', '
					)}`
				);

				res.status(200).json({ message: 'User details updated successfully.' });
			} catch (error) {
				logger.error(
					`Error updating user details for userId: ${userId}: ${error.message}`
				); // Log any exceptions
				Sentry.captureException(error);
				res.status(500).json({
					message: 'Failed to update user details. Please try again.',
				});
			}
		}
	);

	router.get('/details', authenticateToken, async (req, res) => {
		const userId = req.user.userId; // Assuming authenticateToken middleware adds user info to req
		logger.info(`Fetching user details for userId: ${userId}`); // Log the start of the process

		try {
			const user = await User.findById(userId).select('-password'); // Exclude password from the result
			if (!user) {
				logger.warn(`User not found for userId: ${userId}`); // Log when user is not found
				return res.status(404).json({ message: 'User not found.' });
			}

			// Prepare the data to be returned
			const userDetails = {
				userId: user._id,
				email: user.email,
				firstName: user.firstName,
			};

			logger.info(`User details fetched successfully for userId: ${userId}`);
			res.status(200).json(userDetails);
		} catch (error) {
			logger.error(
				`Error fetching user details for userId: ${userId}: ${error.message}`
			); // Log any exceptions
			Sentry.captureException(error);
			res.status(500).json({
				message: 'Failed to fetch user details. Please try again.',
			});
		}
	});

	/**
	 * Route handler for initiating a password reset process. Validates the request body against the forgotPasswordSchema,
	 * generates a password reset token, saves it with the user's record, and sends a password reset email.
	 * Responds with a 200 status code and a message indicating that the reset email has been sent.
	 * On failure, such as if the user is not found or there's an error during the process, responds with an appropriate error message and status code.
	 */

	router.post(
		'/forgot-password',
		validateRequest(forgotPasswordSchema),
		async (req, res) => {
			const { email } = req.body;
			logger.info(`Password reset requested for email: ${email}`); // Log the initiation of a password reset request

			try {
				const user = await User.findOne({ email });
				if (!user) {
					logger.warn(
						`Password reset failed: User not found for email: ${email}`
					); // Log when user is not found
					return res.status(404).json({ message: 'User not found.' });
				}

				await handlePasswordReset(user);

				res.status(200).json({
					message: 'Password reset email sent. Redirecting to login page...',
				});
			} catch (error) {
				logger.error(
					`Failed to process password reset for email: ${email}. Error: ${error.message}`
				); // Log any exceptions
				Sentry.captureException(error);
				res
					.status(500)
					.json({ message: 'Failed to process password reset request.' });
			}
		}
	);

	/**
	 * Route handler for resetting the password. Validates the request body against the resetPasswordSchema,
	 * verifies the reset token and its expiration, hashes the new password, and updates the user's password in the database.
	 * Responds with a 200 status code and a success message upon successful password reset.
	 * On failure, such as if the token is invalid, has expired, or there's an error during the reset process, responds with an appropriate error message and status code.
	 */

	router.post(
		'/reset-password',
		validateRequest(resetPasswordSchema),
		async (req, res) => {
			const { token, newPassword } = req.body;

			logger.info(`Password reset process initiated with token: ${token}`);

			try {
				const user = await User.findOne({
					resetToken: token,
					resetTokenExpiration: { $gt: Date.now() },
				});

				if (!user) {
					// Log when the token is invalid or has expired
					logger.warn(
						`Password reset failed: Token is invalid or has expired. Token: ${token}`
					);
					return res
						.status(400)
						.json({ message: 'Token is invalid or has expired.' });
				}

				// Hash new password and update user document
				const hashedPassword = await bcrypt.hash(newPassword, 12);
				user.password = hashedPassword;
				user.resetToken = undefined;
				user.resetTokenExpiration = undefined;
				if (user.resetTokenForceFlag) {
					user.resetTokenForceFlag = undefined;
				}
				await user.save();

				// Log successful password reset
				logger.info(`Password successfully reset for user: ${user._id}`);
				res.status(200).json({ message: 'Password has been reset.' });
			} catch (error) {
				// Log any exceptions that occur during the password reset process
				logger.error(
					`An error occurred during the password reset process. Token: ${token}, Error: ${error.message}`
				);
				Sentry.captureException(error);
				res.status(500).json({
					message:
						'An error occurred while resetting the password. Please try again.',
				});
			}
		}
	);

	/**
	 * Route handler for logging out the user. Clears the HttpOnly cookie containing the JWT token,
	 * effectively logging the user out of the application.
	 * Responds with a 200 status code and a success message.
	 */

	router.post('/logout', (req, res) => {
		// Log the user's attempt to log out
		logger.info('User logout initiated');

		res.clearCookie('token');
		res.status(200).json({ message: 'Logged out successfully' });

		// Log the successful logout
		logger.info('User logged out successfully');
	});

	/**
	 * Route handler for checking the user's authentication status. Requires authentication.
	 * Verifies the user's authentication and returns their login status, user ID, and admin status.
	 * Responds with a 200 status code and the authentication status.
	 * On failure, such as if the user is not found, responds with an appropriate error message and status code.
	 */

	router.get('/status', authenticateToken, async (req, res) => {
		try {
			// Log the attempt to check user's authentication status
			logger.info(
				`Checking authentication status for userId: ${req.user.userId}`
			);

			const user = await User.findById(req.user.userId);
			if (!user) {
				// Log if the user is not found
				logger.warn(
					`User not found during authentication status check for userId: ${req.user.userId}`
				);
				return res.status(404).json({ message: 'User not found.' });
			}

			res.status(200).json({
				isLoggedIn: true,
				userId: req.user.userId,
				isAdmin: user.isAdmin,
			});

			// Log the successful authentication status check
			logger.info(
				`Authentication status checked successfully for userId: ${req.user.userId}`
			);
		} catch (error) {
			// Log any errors during the authentication status check
			logger.error(
				`Error checking authentication status for userId: ${req.user.userId}. Error: ${error.message}`
			);
			Sentry.captureException(error);
			res.status(500).json({ message: 'Error checking user status.' });
		}
	});

	router.get('/my-rescue', authenticateToken, async (req, res) => {
		const userId = req.user.userId; // Assuming authenticateToken adds user to req

		logger.info(`Fetching rescue organization for user ${userId}`);

		try {
			// Find a rescue where the user is listed as a staff member
			// Ensure your Rescue schema includes an array of staff objects with a userId field
			const rescue = await Rescue.findOne({ 'staff.userId': userId }).populate({
				path: 'staff.userId', // Path to the field you want to populate.
				select: 'email', // Field(s) you want from the populated documents, in this case, just the email.
			});
			if (!rescue) {
				logger.warn(
					`User ${userId} is not a staff member of any rescue organization`
				);
				return res.status(404).send({
					message: 'User is not a staff member of any rescue organization',
				});
			}

			logger.info(
				`Rescue organization fetched successfully for user ${userId}`
			);
			const responseData = {
				id: rescue.id,
				rescueName: rescue.rescueName,
				rescueAddress: rescue.rescueAddress,
				rescueType: rescue.rescueType,
				referenceNumber: rescue.referenceNumber,
				referenceNumberVerified: rescue.referenceNumberVerified,
				staff: rescue.staff, // Consider filtering or restructuring this data based on your needs
			};

			res.json(responseData);
		} catch (error) {
			Sentry.captureException(error);
			logger.error(
				`Failed to fetch rescue organization for user ${userId}: ${error}`
			);
			res.status(500).send({
				message: 'An error occurred while fetching the rescue organization',
				error: error.message,
			});
		}
	});

	router.get('/permissions', authenticateToken, async (req, res) => {
		const userId = req.user.userId; // Extract userId from the token
		logger.info(`Fetching permissions for userId: ${userId}`); // Log the operation

		try {
			// Query the Rescue collection to find a document where this user is listed as staff
			// and directly project the staff member's permissions to optimize the query.
			const rescue = await Rescue.findOne(
				{ 'staff.userId': userId },
				{ 'staff.$': 1 }
			);
			if (!rescue) {
				logger.warn(
					`User ${userId} is not a staff member of any rescue organization`
				);
				return res.status(404).json({
					message: 'User is not a staff member of any rescue organization.',
				});
			}

			// Extract the permissions from the staff member's data
			const userStaffInfo = rescue.staff.find(
				(staff) => staff.userId.toString() === userId
			);
			if (!userStaffInfo) {
				return res
					.status(404)
					.json({ message: 'Staff member information not found.' });
			}

			const permissions = userStaffInfo.permissions || [];

			logger.info(`Permissions fetched successfully for userId: ${userId}`);
			res.status(200).json({ permissions });
		} catch (error) {
			logger.error(
				`Error fetching permissions for userId: ${userId}: ${error.message}`
			); // Log any exceptions
			Sentry.captureException(error);
			res.status(500).json({ message: 'Failed to fetch permissions.' });
		}
	});

	// Return the configured router.
	return router;
}
