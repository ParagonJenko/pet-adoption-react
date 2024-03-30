import React, { useState, useEffect } from 'react';
import { ListGroup, Container, Row, Col } from 'react-bootstrap';
import axios from 'axios';

const RescueConversations = () => {
	const [conversations, setConversations] = useState([]);

	useEffect(() => {
		const apiUrl = import.meta.env.VITE_API_BASE_URL;

		const fetchConversations = async () => {
			try {
				const userId = localStorage.getItem('userId');
				// Use the rescueId as the participantId to fetch relevant conversations
				const conversationsResponse = await axios.get(
					`${apiUrl}/conversations/?type=User&participantId=${userId}`,
					{
						withCredentials: true,
					}
				);
				setConversations(conversationsResponse.data);
			} catch (error) {
				console.error('Error fetching rescue conversations:', error);
			}
		};
		fetchConversations();
	}, []);

	return (
		<div
			className='d-flex flex-column align-items-stretch flex-shrink-0 bg-body-tertiary'
			style={{ width: '380px' }}
		>
			<Container className='p-3 border-bottom'>
				<Row className='align-items-center'>
					<Col>
						<span className='fs-5 fw-semibold'>My Messages</span>
					</Col>
				</Row>
			</Container>
			<ListGroup className='list-group-flush border-bottom scrollarea'>
				{conversations.map((conversation) => (
					<ListGroup.Item
						action
						key={conversation._id}
						className={`py-3 lh-sm ${
							conversation.status === 'active'
								? 'active'
								: 'closed-conversation'
						}`}
						aria-current={conversation.status === 'active' ? 'true' : undefined}
					>
						<div className='d-flex w-100 align-items-center justify-content-between'>
							<strong className='mb-1'>{conversation.lastMessage}</strong>
							<small
								className={
									conversation.status === 'active' ? '' : 'text-body-secondary'
								}
							>
								{conversation.LastMessageAt
									? conversation.LastMessageAt
									: 'Date'}
							</small>
						</div>
						{/* Adjust based on your conversation object */}
						<div className='col-10 mb-1 small'>{conversation.content}</div>
					</ListGroup.Item>
				))}
			</ListGroup>
		</div>
	);
};

export default RescueConversations;
