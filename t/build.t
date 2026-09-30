use Test2::V0;

# the .html files are committed, so they can be left behind by an edit to
# the .md files or to the template.

my $out = `$^X build.pl --check 2>&1`;
is $?, 0, 'docs/*.html are up to date with build.pl'
  or diag $out, 'run: perl build.pl';

done_testing;
