import { PluginConfig } from 'plugins'

const config: PluginConfig = {
	name: 'SASS/SCSS',
	description:
		'Sass is a stylesheet language that’s compiled to CSS. It allows you to use variables, nested rules, mixins, functions, and more, all with a fully CSS-compatible syntax.',
	url: 'https://sass-lang.com/documentation',
	extend: {
		_app: {
			import: ['import "styles/global.scss"'],
		},
	},
}

module.exports = config
