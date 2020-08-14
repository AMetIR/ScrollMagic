import typescript from 'rollup-plugin-typescript2';
import pkg from './package.json';
import { terser } from 'rollup-plugin-terser';
export default {
	input: 'src/scrollmagic.ts',
	output: [
		{
			file: pkg.main,
			format: 'cjs',
		},
		{
			file: 'dist/scrollmagic.browser.js',
			format: 'iife',
			name: pkg.title, // the global which can be used in a browser
		},
	],
	external: [...Object.keys(pkg.dependencies || {})],
	plugins: [
		typescript({
			typescript: require('typescript'),
		}),
		terser(), // minifies generated bundles
	],
};