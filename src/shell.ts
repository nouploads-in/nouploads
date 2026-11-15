import { tr } from './locale';

if (!document.body.dataset.staticShell) {
  const hindi = document.documentElement.lang === 'hi';
  const root = hindi ? '/hi' : '';
  const route = location.pathname.replace(/^\/hi(?=\/)/, '').replace(/index.html$/, '').replace('/pdf-unlock.html', '/pdf-unlock');
  const active = route.startsWith('/exam/') ? '/exam/' : route === '/pdf-unlock' ? route : route === '/' ? '/' : '';
  const links = [['/', tr('Photo & signature')], ['/pdf-unlock', tr('PDF password remover')], ['/exam/', tr('Exam photo sizes')]];
  document.querySelector('header')!.innerHTML = '<a class="brand" href="' + root + '/"><img class="brand-mark" src="/favicon.svg" alt="" width="34" height="34">nouploads<span>.in</span></a><nav class="primary-nav" aria-label="' + tr('Tools') + '">' + links.map(([href, text]) => '<a href="' + root + href + '"' + (active === href ? ' aria-current="page"' : '') + '>' + text + '</a>').join('') + '</nav><div class="language-switch" role="group" aria-label="' + tr('Language') + '">' + (hindi ? '<a data-language-switch lang="en" href="' + route + '">EN</a><span class="selected" lang="hi">हिंदी</span>' : '<span class="selected" lang="en">EN</span><a data-language-switch lang="hi" href="/hi' + route + '">हिंदी</a>') + '</div>';
}
