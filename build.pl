#!/usr/bin/env perl

use v5.042;
use warnings;
use FindBin ();
use File::Find qw( find );
use Markdown::Perl ();

# Usage: perl build.pl [--check]
#
# Renders each docs/**/*.md through template/page.html to the .html next to
# it.  With --check nothing is written, and the exit status says whether the
# .html files are up to date.

my $check = (@ARGV && $ARGV[0] eq '--check');

my $root     = $FindBin::Bin;
my $template = slurp("$root/template/page.html");

my @markdown;
find({ no_chdir => 1, wanted => sub { push @markdown, $_ if /\.md\z/ } }, "$root/docs");

my $stale = 0;

foreach my $md (sort @markdown)
{
  my $html = $md =~ s/\.md\z/.html/r;
  my $page = $html =~ s{^\Q$root\E/docs/}{}r =~ s/\.html\z//r;

  my $content = Markdown::Perl::convert(slurp($md), mode => 'github');

  # the one and only h1 is the title of the page, and is shown in the frame
  # of the window instead of inside it.
  $content =~ s{<h1\b[^>]*>(.*?)</h1>\s*}{}s
    or die "$md: no h1 title\n";
  my $title = $1 =~ s/<[^>]*>//gr;
  die "$md: more than one h1 title\n" if $content =~ /<h1\b/;

  my %var = ( title => $title, page => $page, content => $content =~ s/\s+\z//r );
  my $out = $template =~ s/\{\{(\w+)\}\}/$var{$1} \/\/ die "$md: unknown template variable $1\n"/ger;

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

sub slurp ($path)
{
  open my $fh, '<:encoding(UTF-8)', $path or die "$path: $!\n";
  local $/;
  <$fh>;
}
