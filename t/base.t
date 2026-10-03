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

req(
  GET('https://turboperl.org'),
  res {
    code 200;
  },
);

tx->note;

done_testing;
