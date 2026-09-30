This is the source for the site:

 * [https://turbo-perl.github.io]

## Working on it

The pages are written in `docs/`, and `build.pl` renders each one through
the templates in `template/` to the `.html` beside it.  The `.html` files
are committed, since GitHub Pages serves `docs/` as it is.

 * `*.md` is a document in Markdown, shown in the window.  It has exactly
   one `# title`, which becomes the title of the document and of the
   window's frame.
 * `*.dialog` is YAML with a `title` and a `message`, shown in a dialog on
   an otherwise empty desktop.  A blank line in the message starts a new
   paragraph.

```sh
cpanm --installdeps .
perl build.pl          # after editing a source or a template
plackup test.psgi      # the site, on http://localhost:5000
prove t
```

The look of the app is in `docs/css/turboperl.css` and its behaviour in
`docs/js/turboperl.js`.  The menus, the status line and the About dialog are
in `template/page.html`, so they are the same on every page.

## Credits

The font is IBM VGA 8x16 from
[The Ultimate Oldschool PC Font Pack](https://int10h.org/oldschool-pc-fonts/)
by VileR, used under the Creative Commons Attribution-ShareAlike 4.0
International License; see `docs/fonts/LICENSE.txt`.
