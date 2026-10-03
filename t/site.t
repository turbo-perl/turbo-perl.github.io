use Test2::Require::Module 'Test2::Tools::HTTP';
use Test2::Require::Module 'Mojo::DOM58';
use Test2::Require::Module 'Importer';
use Test2::V0;
use Importer 'Test2::Tools::HTTP' => ':short';
use Mojo::DOM58;
use HTTP::Request::Common;

Test2::Tools::HTTP::http_base_url 'https://turboperl.org';
Test2::Tools::HTTP::Tx->add_helper(
  'res.dom' => sub {
    my($res) = @_;
    Mojo::DOM58->new($res->decoded_content);
  },
);

app_add do "./test.psgi";

my @pages = (
  # url            code  page     title            message, for a page that is a dialog
  [ '/',           200, 'index', 'TurboPerl IDE' ],
  [ '/index.html', 200, 'index', 'TurboPerl IDE' ],
  [ '/404.html',   200, '404',   'Error',         qr/stale or broken link/ ],
  [ '/bogus/url',  404, '404',   'Error',         qr/stale or broken link/ ],
);

foreach my $page (@pages)
{
  my($url, $code, $name, $title, $message) = @$page;

  subtest $url => sub {

    req(
      GET("https://turboperl.org$url"),
      res {
        code $code;
        content_type 'text/html';
      },
    );

    my $dom = tx->res->dom;

    is $dom->at('body')->attr('data-page'), $name, 'page name';

    is $dom->at('head > title')->text, $title, 'title of the document';
    is $dom->find('h1')->size, 0, 'which is not repeated in the page';

    subtest 'window' => sub {
      is $dom->at('#desktop > #window.tv-window > .tv-title')->text, $title, 'title in the frame';
      ok $dom->at('#window > .tv-content'), 'document is in the window';
      ok !$dom->at('.tv-dialog[data-open]'), 'no dialog to start with';
    } unless $message;

    subtest 'dialog' => sub {
      my $dialog = $dom->at('#desktop > #dialog.tv-dialog');
      ok exists $dialog->attr->{'data-open'}, 'open to start with';
      ok !exists $dialog->attr->{hidden}, 'and not hidden';
      is $dialog->at('.tv-title')->text, $title, 'title in the frame';
      like $dialog->at('.tv-content > p')->text, $message, 'message';
      is $dialog->at('button')->all_text, 'Ok', 'button';
      ok !$dom->at('#window'), 'no window behind it';
    } if $message;

    subtest 'menus' => sub {
      my @menus = $dom->find('#menubar > .tv-menu')->each;

      is
        [ map { menu($_) } @menus ],
        [
          {
            title => 'File',
            hot   => 'F',
            items => [
              { label => 'Home', hot => 'H', href => '/' },
              '-',
              { label => 'Exit', hot => 'x', command => 'exit', shortcut => 'Alt-X' },
            ],
          },
          {
            title => 'Help',
            hot   => 'H',
            items => [
              { label => 'About...', hot => 'A', command => 'about' },
            ],
          },
        ],
        'File and Help';
    };

    subtest 'status line' => sub {
      my @items = $dom->find('#statusline > a')->each;
      is scalar @items, 1, 'one item';
      is $items[0]->all_text, 'Alt-X Exit', 'label';
      is $items[0]->at('.tv-hot')->text, 'Alt-X', 'key';
      is $items[0]->attr('data-command'), 'exit', 'command';
    };

    subtest 'about' => sub {
      my $about = $dom->at('#about.tv-dialog');
      ok exists $about->attr->{hidden}, 'hidden until asked for';
      is $about->at('.tv-title')->text, 'About', 'title';
      like $about->at('.tv-content')->all_text, qr/A Turbo Pascal style IDE for Perl/, 'text';
      is $about->at('button')->all_text, 'Ok', 'button';
    };

    subtest 'screen' => sub {
      ok $dom->at('#clock'), 'clock';
      ok exists $dom->at('#dos')->attr->{hidden}, 'DOS prompt is hidden until exit';
      like $dom->at('#dos')->all_text, qr/^C:\\>/, 'DOS prompt';
      ok $dom->at('#dos > #dos-line > #dos-input'), 'with somewhere to type a command';
    };

    subtest 'assets' => sub {
      # absolute, since the 404 page is served for a URL at any depth
      is
        [ $dom->find('link[rel=stylesheet]')->map(attr => 'href')->each ],
        [ '/css/turboperl.css' ],
        'style sheet';
      is
        [ $dom->find('script[src]')->map(attr => 'src')->each ],
        [ '/js/turboperl.js' ],
        'script';
      is
        [ $dom->find('link[rel=icon]')->map(attr => 'href')->each ],
        [ '/favicon.ico', '/favicon.svg' ],
        'favicon';
    };

  };
}

subtest 'assets' => sub {

  # the types for these two depend on the version of Plack
  my %assets = (
    '/css/turboperl.css'               => 'text/css',
    '/js/turboperl.js'                 => match(qr{^(?:application|text)/javascript$}),
    '/fonts/WebPlus_IBM_VGA_8x16.woff' => match(qr{^(?:application/font-woff|font/woff)$}),
    '/fonts/LICENSE.txt'               => 'text/plain',
    '/favicon.ico'                     => match(qr{^image/(?:x-icon|vnd\.microsoft\.icon)$}),
    '/favicon.svg'                     => 'image/svg+xml',
  );

  foreach my $url (sort keys %assets)
  {
    req(
      GET("https://turboperl.org$url"),
      res {
        code 200;
        content_type $assets{$url};
      },
    );
  }

  req(GET('https://turboperl.org/fonts/LICENSE.txt'));
  like tx->res->decoded_content, qr/Attribution-ShareAlike 4\.0/, 'font license';

  req(GET('https://turboperl.org/css/turboperl.css'));
  like tx->res->decoded_content, qr{url\("/fonts/WebPlus_IBM_VGA_8x16\.woff"\)}, 'style sheet uses the font';
};

done_testing;

sub menu
{
  my($menu) = @_;

  my @items = map {
    my $a = $_->at('a');
    $a
      ? {
          label => $a->all_text,
          hot   => $a->at('.tv-hot')->text,
          $a->attr('data-command')
            ? (command => $a->attr('data-command'))
            : (href    => $a->attr('href')),
          $a->attr('data-shortcut') ? (shortcut => $a->attr('data-shortcut')) : (),
        }
      : '-';
  } $menu->find('.tv-menu-items > li')->each;

  {
    title => $menu->at('.tv-menu-title')->all_text,
    hot   => $menu->at('.tv-menu-title > .tv-hot')->text,
    items => \@items,
  };
}
