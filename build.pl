#!/usr/bin/env perl

use v5.042;
use warnings;
use FindBin ();
use File::Find qw( find );
use Markdown::Perl ();
use YAML::PP ();

# Usage: perl build.pl [--check]
#
# Renders the sources in docs/ to the .html next to them:
#
#   *.md      a document, shown in the window
#   *.dialog  YAML with a title and a message, shown in a dialog
#
# With --check nothing is written, and the exit status says whether the
# .html files are up to date.

my $check = (@ARGV && $ARGV[0] eq '--check');

my $root     = $FindBin::Bin;
my %template = map { $_ => slurp("$root/template/$_.html") } qw( page window dialog );

my %render = ( md => \&document, dialog => \&dialog );

my %source;
find({
  no_chdir => 1,
  wanted   => sub {
    return unless /\.(md|dialog)\z/;
    my $html = s/\.(md|dialog)\z/.html/r;
    die "$_ and $source{$html} are both $html\n" if $source{$html};
    $source{$html} = $_;
  },
}, "$root/docs");

my $stale = 0;

foreach my $html (sort keys %source)
{
  my $source = $source{$html};
  my $page   = $html =~ s{^\Q$root\E/docs/}{}r =~ s/\.html\z//r;

  my($title, $body) = $render{ $source =~ s/.*\.//r }->($source);
  my $out = fill($source, 'page', title => $title, page => $page, body => $body);

  if($check)
  {
    next if -f $html && slurp($html) eq $out;
    say "stale: docs/$page.html";
    $stale = 1;
  }
  else
  {
    open my $fh, '>:encoding(UTF-8)', $html or die "$html: $!\n";
    print $fh $out;
    close $fh or die "$html: $!\n";
    say "docs/$page.html";
  }
}

exit $stale;

sub document ($md)
{
  my $content = Markdown::Perl::convert(slurp($md), mode => 'github');

  # the one and only h1 is the title of the page, and is shown in the frame
  # of the window instead of inside it.
  $content =~ s{<h1\b[^>]*>(.*?)</h1>\s*}{}s
    or die "$md: no h1 title\n";
  my $title = $1 =~ s/<[^>]*>//gr;
  die "$md: more than one h1 title\n" if $content =~ /<h1\b/;

  $title, fill($md, 'window', title => $title, content => $content =~ s/\s+\z//r);
}

sub dialog ($yaml)
{
  my $dialog = YAML::PP->new->load_string(slurp($yaml));
  die "$yaml: not a mapping\n" unless ref $dialog eq 'HASH';

  my %dialog = %$dialog;
  my($title, $message) = map {
    my $value = delete $dialog{$_};
    die "$yaml: no $_\n" unless defined $value && !ref $value && $value =~ /\S/;
    escape($value =~ s/\A\s+|\s+\z//gr);
  } qw( title message );
  die "$yaml: unknown key: @{[ sort keys %dialog ]}\n" if %dialog;

  # a blank line in the message starts a new paragraph
  my $content = join "\n", map { "<p>$_</p>" } split /\n\s*\n/, $message;

  $title, fill($yaml, 'dialog', title => $title, content => $content);
}

sub fill ($source, $name, %var)
{
  $template{$name} =~ s/\{\{(\w+)\}\}/$var{$1} \/\/ die "$source: unknown template variable $1\n"/ger =~ s/\s+\z//r
    . ($name eq 'page' ? "\n" : '');
}

sub escape ($text)
{
  my %entity = ( '&' => '&amp;', '<' => '&lt;', '>' => '&gt;', '"' => '&quot;' );
  $text =~ s/([&<>"])/$entity{$1}/gr;
}

sub slurp ($path)
{
  open my $fh, '<:encoding(UTF-8)', $path or die "$path: $!\n";
  local $/;
  <$fh>;
}
