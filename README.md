This is the source for the site:

 * [https://turbo-perl.github.io]

## Working on it

The pages are written in Markdown in `docs/*.md`, and `build.pl` renders
each one through `template/page.html` to the `.html` beside it.  The `.html`
files are committed, since GitHub Pages serves `docs/` as it is.

```sh
cpanm --installdeps .
perl build.pl          # after editing a .md file or the template
plackup test.psgi      # the site, on http://localhost:5000
prove t
```

Each page has exactly one `# title`, which becomes the title of the document
and of the window's frame.

The look of the app is in `docs/css/turboperl.css` and its behaviour in
`docs/js/turboperl.js`.  The menus, the status line and the About dialog are
in the template, so they are the same on every page.

## Credits

The font is IBM VGA 8x16 from
[The Ultimate Oldschool PC Font Pack](https://int10h.org/oldschool-pc-fonts/)
by VileR, used under the Creative Commons Attribution-ShareAlike 4.0
International License; see `docs/fonts/LICENSE.txt`.
