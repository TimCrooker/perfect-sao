import chalk from 'chalk'
import { Logger } from './logger'
import { CLI } from './cli'

export type Route<RuntimeEnvInstance = any> = (
	app: CLI<RuntimeEnvInstance>,
	input: {
		/** args passed from the initial command line */
		args: any[]
		/** options passed from the initial command line */
		options: { [key: string]: any }
	}
) => void | Promise<void>

type Routes<RuntimeEnvInstance = any> = {
	[k: string]: Route<RuntimeEnvInstance>
}

type Navigate = { route: string; args: any; context: CLI }

type RouteHistory = Navigate[]

export interface RouterOptions {
	logger: Logger
}

/**
 * The router is in charge of handling `yo` different screens.
 */
export class Router<RuntimeEnvInstance = any> {
	routes: Routes<RuntimeEnvInstance>

	logger: Logger

	routeHistory: RouteHistory = []

	constructor(opts: RouterOptions) {
		this.routes = {}

		this.logger = opts.logger
	}

	/**
	 * Navigate to a route
	 * @param route Route name
	 * @param args the arguments to pass to the route handler
	 */
	async navigate(route: string, args: any, context: CLI): Promise<this> {
		this.logger.debug('Navigating to route:', chalk.yellow(route))

		if (typeof this.routes[route] === 'function') {
			//store the call to routeHistory
			this.saveNavigateCall({ route, args, context })
			try {
				await this.routes[route](context, args)
			} catch (error) {
				this.routeHistory.pop()
				this.logger.error('Something went wrong in the route handler:', error)
				this.goBack()
			}
		} else {
			this.logger.error(`No routes named:`, chalk.yellow(route))
			await this.goBack()
		}
		return this
	}

	saveNavigateCall(navigationCall: Navigate): void {
		this.routeHistory.push(navigationCall)
	}

	async goBack(): Promise<void> {
		const lastCall = this.routeHistory.pop()
		if (lastCall !== undefined) {
			const { route, args, context } = lastCall
			await this.navigate(route, args, context)
		}
	}

	/**
	 * Register a route handler
	 * @param name Name of the route
	 * @param handler Route handler
	 */
	registerRoute(name: string, handler: Route): this {
		this.routes[name] = handler
		return this
	}
}
