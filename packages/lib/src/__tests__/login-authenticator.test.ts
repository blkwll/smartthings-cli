import axios, { AxiosResponse } from 'axios'
// import { mocked } from 'ts-jest/utils'
import * as express from 'express'
import * as getPort from 'get-port'
import tmp from 'tmp'

import { Logger } from '@smartthings/core-sdk'

import { logManager } from '..'
import { LoginAuthenticator } from '../login-authenticator'


const profileName = 'myProfile'
const clientIdProvider = {
	baseURL: 'https://example.com/unused-here',
	authURL: 'https://example.com/unused-here',
	keyApiURL: 'https://example.com/unused-here',
	baseOAuthInURL: 'https://example.com/oauth-in-url',
	oauthAuthTokenRefreshURL: 'https://example.com/refresh-url',
	clientId: 'client-id',
}

jest.mock('get-port')
jest.mock('express')

async function sleep(milliseconds: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, milliseconds))
}

describe('LoginAuthenticator', () => {
	let mockedAxios: jest.Mocked<typeof axios>
	let logger: Logger

	beforeAll(() => {
		jest.mock('axios')
		// const mockedAxios = mocked(axios, true)
		mockedAxios = axios as jest.Mocked<typeof axios>

		const config = {
			appenders: {
				main: { type: 'recording' },
				stdout: { type: 'stdout' },
			},
			categories: {
				default: { appenders: ['main'], level: 'WARN' },
				'login-authenticator': { appenders: ['stdout'], level: 'TRACE' },
			},
		}
		logManager.init(config)
		logger = logManager.getLogger('auth-test')
	})

	describe('constructor and init', () => {
		it('throws exception when not init not called', function() {
			expect(() => new LoginAuthenticator(profileName, clientIdProvider))
				.toThrow('LoginAuthenticator credentials file not set.')
		})

		it('init sets _credentialsFile properly', function() {
			const tmpFilename = tmp.tmpNameSync()
			LoginAuthenticator.init(tmpFilename)
			expect((global as { _credentialsFile?: string })._credentialsFile).toBe(tmpFilename)
		})

		it('constructs without errors', function() {
			const tmpFilename = tmp.tmpNameSync()
			LoginAuthenticator.init(tmpFilename)
			const loginAuthenticator = new LoginAuthenticator(profileName, clientIdProvider)
			expect(loginAuthenticator).toBeDefined()
		})
	})

	// TODO: delete
	describe('tempForTest', () => {
		it('works on the happy path', async () => {
			const tmpFilename = tmp.tmpNameSync()
			LoginAuthenticator.init(tmpFilename)
			const loginAuthenticator = new LoginAuthenticator(profileName, clientIdProvider)

			jest.spyOn(getPort, 'default').mockResolvedValue(7777)

			const value = await loginAuthenticator.tempForTest()

			expect(value).toBe(7777)

			expect(getPort.default).toHaveBeenCalledTimes(1)
			expect(getPort.default).toHaveBeenCalledWith({ port: [61973, 61974, 61975] })
		})
	})

	describe('login', () => {
		it.only('works on the happy path', async () => {
			const tmpFilename = tmp.tmpNameSync()
			LoginAuthenticator.init(tmpFilename)
			const loginAuthenticator = new LoginAuthenticator(profileName, clientIdProvider)

			const mockApp = {
				get: jest.fn(),
				listen: jest.fn(),
			}
			jest.doMock('express', () => { return () => mockApp })

			const mockServer = {
				close: jest.fn(),
			}

			let startHandler: (request: Request, response: Response) => void = () => { /* */ }
			let finishHandler: (request: Request, response: Response) => void = () => { /* */ }
			mockApp.get.mockImplementation((path, handler) => {
				if (path === '/start') {
					startHandler = handler
				} else if (path === '/finish') {
					finishHandler = handler
				}
			})

			jest.spyOn(getPort, 'default').mockResolvedValue(7777)
			jest.spyOn(express, 'default').mockReturnValue(mockApp as unknown as express.Express)
			// mockApp.listen.mockReturnValue(mockServer)
			mockApp.listen.mockImplementation((port, handler) => {
				expect(port).toBe(7777)
				// save handler and then call it after mocking `open`
				// listenHandler
				return mockServer
			})

			const loginPromise = loginAuthenticator.login()

			while (!startHandler || !finishHandler) {
				await sleep(25)
			}
			const mockStartResponse = {
				redirect: jest.fn(),
			}
			const mockFinishRequest = {
				query: { code: 'auth-code' },
			}
			const mockFinishResponse = {
				send: jest.fn(),
			}
			startHandler({} as Request, mockStartResponse as unknown as Response)
			finishHandler(mockFinishRequest as unknown as Request, mockFinishResponse as unknown as Response)

			await loginPromise

			expect(getPort.default).toHaveBeenCalledTimes(1)
			expect(getPort.default).toHaveBeenCalledWith({ port: [61973, 61974, 61975] })

			expect(mockApp.get).toHaveBeenCalledTimes(2)
			expect(mockApp.listen).toHaveBeenCalledTimes(1)

			expect(mockStartResponse.redirect).toHaveBeenCalledTimes(1)

			expect(mockFinishResponse.send).toHaveBeenCalledTimes(1)
		})

		// TODO:
	})

	describe('authenticate', () => {
		let loginAuthenticator: LoginAuthenticator
		beforeEach(() => {
			const tmpFilename = tmp.tmpNameSync()
			LoginAuthenticator.init(tmpFilename)
			loginAuthenticator = new LoginAuthenticator(profileName, clientIdProvider)
		})

		it('calls login in automatically', function() {
			jest.spyOn(LoginAuthenticator.prototype, 'login').mockResolvedValue()
			const request = {}
			const response: AxiosResponse = {
				data: {},
				status: 200,
				statusText: '',
				headers: '',
				config: {},
			}
			axios.post = jest.fn().mockResolvedValue(response)
			loginAuthenticator.authenticate(request)

			expect(loginAuthenticator.login).toHaveBeenCalledTimes(1)
		})

		it.todo('refreshes token automatically')
	})
})
