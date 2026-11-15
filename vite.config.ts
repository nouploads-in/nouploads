import { configDefaults, defineConfig } from 'vitest/config';
import generalTools from './presets/general-tools.json';
import exams from './presets/exams.json';
import unverified from './presets/unverified-exams.json';
import pdf from './presets/pdf-pages.json';
import info from './presets/info-pages.json';

const pdfPages = [...pdf.intents.map(page => page.id), 'pdf-password', ...pdf.documents.map(page => 'pdf-password/' + page.id)].flatMap(route => ['', 'hi/'].map(root => root + route + '/index.html'));

const generalPages = generalTools.flatMap(tool => ['', 'hi/'].map(root => root + tool.id + '/index.html'));
const infoPages = info.pages.flatMap(page => ['', 'hi/'].map(root => root + page.id + '/index.html'));
const examPages = exams.filter(exam => exam.verified).flatMap(exam => (('languages' in exam ? exam.languages : undefined) ?? ['en', 'hi']).map(lang => (lang === 'hi' ? 'hi/' : '') + 'exam/' + exam.id + '/index.html'));
examPages.push(...unverified.flatMap(exam => exam.languages.map(lang => (lang === 'hi' ? 'hi/' : '') + 'exam/' + exam.id + '/index.html')));

const devWithoutCsp = {
  name: 'dev-without-csp',
  apply: 'serve' as const,
  transformIndexHtml: (html: string) => html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '')
};

export default defineConfig({
  test: { exclude: [...configDefaults.exclude, '.worktrees/**'] },
  base: './',
  plugins: [devWithoutCsp],
  build: { rollupOptions: { input: ['hi/index.html', 'hi/pdf-unlock.html', 'hi/404.html', '404.html', 'index.html', 'pdf-unlock.html', 'exam/index.html', 'hi/exam/index.html', ...examPages, ...generalPages, ...infoPages, ...pdfPages] } },
  worker: { format: 'es' }
});
