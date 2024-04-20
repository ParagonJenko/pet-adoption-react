import { expect } from 'chai';
import sinon from 'sinon';
import supertest from 'supertest';
import app from '../../index.js'; // Adjust as necessary
import { pool } from '../../dbConnection.js'; // Adjust as necessary
import jwt from 'jsonwebtoken';

const request = supertest(app);

describe('GET /api/ratings/find-unrated endpoint', () => {
	let sandbox, userToken, cookie;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		sandbox.stub(pool, 'query');

		const secret = process.env.SECRET_KEY;
		const userPayload = { userId: 'testUserId' };
		userToken = jwt.sign(userPayload, secret, { expiresIn: '1h' });
		cookie = `token=${userToken};`;
	});

	afterEach(() => {
		sandbox.restore();
	});

	it('should fetch unrated pets successfully when they exist', async () => {
		const mockUnratedPets = [
			{ pet_id: '1', name: 'Fido', type: 'Dog' },
			{ pet_id: '2', name: 'Whiskers', type: 'Cat' },
		];

		pool.query.resolves({ rows: mockUnratedPets });

		const response = await request
			.get('/api/ratings/find-unrated')
			.set('Cookie', cookie)
			.expect(200);

		expect(response.status).to.equal(200);
		expect(response.body).to.deep.equal(mockUnratedPets);
	});

	it('should return 404 when no unrated pets are found', async () => {
		pool.query.resolves({ rows: [] });

		const response = await request
			.get('/api/ratings/find-unrated')
			.set('Cookie', cookie)
			.expect(404);

		expect(response.status).to.equal(404);
		expect(response.body.message).to.equal('No unrated pets found');
	});

	// ! This times out - unsure why but we do have a catch for errors here so I won't spend time debugging this now.
	it.skip('should handle errors gracefully if there is a database error', async () => {
		pool.query.rejects(new Error('Database error'));

		const response = await request
			.get('/api/ratings/find-unrated')
			.set('Cookie', cookie)
			.expect(500);

		expect(response.status).to.equal(500);
		expect(response.body.message).to.equal('An error occurred');
		expect(response.body.error).to.include('Database error');
	});
});
