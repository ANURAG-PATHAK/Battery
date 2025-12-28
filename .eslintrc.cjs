module.exports = {
    root: true,
    env: {
        node: true,
        es2022: true,
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname,
    },
    plugins: ['@typescript-eslint', 'import', 'prettier'],
    extends: ['airbnb-base', 'airbnb-typescript/base', 'plugin:prettier/recommended'],
    settings: {
        'import/resolver': {
            typescript: {
                project: './tsconfig.json',
            },
        },
    },
    overrides: [
        {
            files: ['*.cjs', '*.js'],
            parserOptions: {
                project: null,
            },
        },
    ],
    rules: {
        'import/prefer-default-export': 'off',
    },
    ignorePatterns: ['dist', 'node_modules'],
};
