import path from 'path'
import sum from 'hash-sum'
import parsePackageName from 'parse-package-name'
import {
	removeLocalPathPrefix,
	PACKAGES_CACHE_PATH,
	REPOS_CACHE_PATH,
	isLocalPath,
} from '../../config'
import { SAOError } from '../../error'
import { store } from '../../store'
import { escapeDots } from '../../utils/glob'

export interface LocalGenerator {
	type: 'local'
	path: string
	hash: string
	subGenerator?: string
}

export interface NpmGenerator {
	type: 'npm'
	name: string
	version: string
	slug: string
	subGenerator?: string
	hash: string
	path: string
}

export interface RepoGenerator {
	type: 'repo'
	prefix: GeneratorPrefix
	user: string
	repo: string
	version: string
	subGenerator?: string
	hash: string
	path: string
}

export type ParsedGenerator = LocalGenerator | NpmGenerator | RepoGenerator

export type GeneratorPrefix = 'npm' | 'github' | 'gitlab' | 'bitbucket'

export const GENERATOR_PREFIX_RE = /^(npm|github|bitbucket|gitlab):/

/** Infer prefix for naked generator name (without prefix) */
function inferGeneratorPrefix(
	GENERATOR_PREFIX_RE: RegExp,
	generator: string
): string {
	if (!GENERATOR_PREFIX_RE.test(generator)) {
		if (generator.startsWith('@')) {
			generator = `npm:${generator.replace(/\/(sao-)?/, '/sao-')}`
		} else if (generator.includes('/')) {
			generator = `github:${generator}`
		} else {
			generator = `npm:${generator.replace(/^(sao-)?/, 'sao-')}`
		}
	}
	return generator
}

function HandleLocalGenerator(generator: string): LocalGenerator {
	let subGenerator: string | undefined
	if (removeLocalPathPrefix(generator).includes(':')) {
		subGenerator = generator.slice(generator.lastIndexOf(':') + 1)
		generator = generator.slice(0, generator.lastIndexOf(':'))
	}
	const absolutePath = path.resolve(generator)

	return {
		type: 'local',
		path: absolutePath,
		hash: sum(absolutePath),
		subGenerator,
	}
}

function HandleNpmGenerator(generator: string): NpmGenerator {
	const hasSubGenerator = generator.indexOf(':') !== -1
	const slug = generator.slice(
		0,
		hasSubGenerator ? generator.indexOf(':') : generator.length
	)
	const parsed = parsePackageName(slug)
	const hash = sum(`npm:${slug}`)
	return {
		type: 'npm',
		name: parsed.name,
		version: parsed.version || 'latest',
		slug,
		subGenerator: hasSubGenerator
			? generator.slice(generator.indexOf(':') + 1)
			: undefined,
		hash,
		path: path.join(PACKAGES_CACHE_PATH, hash, 'node_modules', parsed.name),
	}
}

function HandleRepoGenerator(
	generator: string,
	prefix: GeneratorPrefix
): RepoGenerator {
	const [, user, repo, version = 'master', subGenerator] =
		/([^/]+)\/([^#:]+)(?:#(.+))?(?::(.+))?$/.exec(generator) || []
	const hash = sum({
		type: 'repo',
		prefix,
		user,
		repo,
		version,
		subGenerator,
	})
	return {
		type: 'repo',
		prefix,
		user,
		repo,
		version,
		subGenerator,
		hash,
		path: path.join(REPOS_CACHE_PATH, hash),
	}
}

function getGeneratorPrefix(generator: string): GeneratorPrefix {
	let prefix: GeneratorPrefix = 'npm'
	let m: RegExpExecArray | null = null
	if ((m = GENERATOR_PREFIX_RE.exec(generator))) {
		prefix = m[1] as GeneratorPrefix
		generator = generator.replace(GENERATOR_PREFIX_RE, '')
	}
	return prefix
}

/** Load the generator config file from the given generator string */
export function parseGenerator(generator: string): ParsedGenerator {
	// Handle user cached generators with aliases
	if (generator.startsWith('alias:')) {
		const alias = generator.slice(6)
		const url = store.get(`alias.${escapeDots(alias)}`) as
			| string
			| undefined
		if (!url) {
			throw new SAOError(`Cannot find alias '${alias}'`)
		}
		return parseGenerator(url)
	}

	// Handle local generators
	if (isLocalPath(generator)) {
		return HandleLocalGenerator(generator)
	}

	generator = inferGeneratorPrefix(GENERATOR_PREFIX_RE, generator)

	// Get generator type, e.g. `npm` or `github`
	const prefix: GeneratorPrefix = getGeneratorPrefix(generator)

	// Generator is an npm package
	if (prefix === 'npm') {
		return HandleNpmGenerator(generator)
	}

	// Generator is a repo
	return HandleRepoGenerator(generator, prefix)
}
