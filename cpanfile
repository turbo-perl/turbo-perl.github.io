requires 'perl', '5.042';
requires 'Markdown::Perl';
requires 'Plack';
requires 'Plack::Builder';
requires 'Plack::App::GitHubPages::Faux';
requires 'Plack::Middleware::Headers';

on test => sub {
  requires 'HTTP::Request::Common';
  requires 'Importer';
  requires 'Mojo::DOM58';
  requires 'Test2::Require::Module';
  requires 'Test2::Tools::HTTP';
  requires 'Test2::V0';
};
