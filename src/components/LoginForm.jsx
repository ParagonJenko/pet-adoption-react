// LoginForm.jsx
import React, { useState } from 'react';
import { Form, Button, Alert } from 'react-bootstrap';
import AlertComponent from './AlertComponent';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext'; // Import useAuth hook

const LoginForm = () => {
	const [formData, setFormData] = useState({ email: '', password: '' });
	const [alert, setAlert] = useState({ message: null, type: null });
	const navigate = useNavigate(); // Initialize useNavigate
	const { login } = useAuth();

	const handleChange = (e) => {
		const { name, value } = e.target;
		setFormData((prevState) => ({
			...prevState,
			[name]: value,
		}));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		try {
			await login(formData.email, formData.password); // Use login method from context
			setAlert({ message: 'Login successful!', type: 'success' });
			navigate('/'); // Redirect to home after successful login
		} catch (error) {
			// Assuming login method throws an error on failure
			setAlert({ message: error.message, type: 'danger' });
		}
	};

	return (
		<>
			{alert.message && (
				<AlertComponent
					type={alert.type}
					message={alert.message}
					onClose={() => setAlert({ message: null, type: null })}
				/>
			)}
			<Form onSubmit={handleSubmit}>
				<Form.Group className='mb-3' controlId='email'>
					<Form.Label>Email address</Form.Label>
					<Form.Control
						type='email'
						name='email'
						value={formData.email}
						onChange={handleChange}
						placeholder='Enter email'
					/>
				</Form.Group>
				<Form.Group className='mb-3' controlId='password'>
					<Form.Label>Password</Form.Label>
					<Form.Control
						type='password'
						name='password'
						value={formData.password}
						onChange={handleChange}
						placeholder='Password'
					/>
				</Form.Group>
				<Button variant='primary' type='submit'>
					Login
				</Button>
			</Form>
			<a href='/forgot-password'>Forgot your password?</a>
		</>
	);
};

export default LoginForm;
