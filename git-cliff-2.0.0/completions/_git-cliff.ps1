
using namespace System.Management.Automation
using namespace System.Management.Automation.Language

Register-ArgumentCompleter -Native -CommandName 'git-cliff' -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)

    $commandElements = $commandAst.CommandElements
    $command = @(
        'git-cliff'
        for ($i = 1; $i -lt $commandElements.Count; $i++) {
            $element = $commandElements[$i]
            if ($element -isnot [StringConstantExpressionAst] -or
                $element.StringConstantType -ne [StringConstantType]::BareWord -or
                $element.Value.StartsWith('-') -or
                $element.Value -eq $wordToComplete) {
                break
        }
        $element.Value
    }) -join ';'

    $completions = @(switch ($command) {
        'git-cliff' {
            [CompletionResult]::new('-i', 'i', [CompletionResultType]::ParameterName, 'Writes the default configuration file to cliff.toml')
            [CompletionResult]::new('--init', 'init', [CompletionResultType]::ParameterName, 'Writes the default configuration file to cliff.toml')
            [CompletionResult]::new('-c', 'c', [CompletionResultType]::ParameterName, 'Sets the configuration file')
            [CompletionResult]::new('--config', 'config', [CompletionResultType]::ParameterName, 'Sets the configuration file')
            [CompletionResult]::new('-w', 'w', [CompletionResultType]::ParameterName, 'Sets the working directory')
            [CompletionResult]::new('--workdir', 'workdir', [CompletionResultType]::ParameterName, 'Sets the working directory')
            [CompletionResult]::new('-r', 'r', [CompletionResultType]::ParameterName, 'Sets the git repository')
            [CompletionResult]::new('--repository', 'repository', [CompletionResultType]::ParameterName, 'Sets the git repository')
            [CompletionResult]::new('--include-path', 'include-path', [CompletionResultType]::ParameterName, 'Sets the path to include related commits')
            [CompletionResult]::new('--exclude-path', 'exclude-path', [CompletionResultType]::ParameterName, 'Sets the path to exclude related commits')
            [CompletionResult]::new('--with-commit', 'with-commit', [CompletionResultType]::ParameterName, 'Sets custom commit messages to include in the changelog')
            [CompletionResult]::new('--skip-commit', 'skip-commit', [CompletionResultType]::ParameterName, 'Sets commits that will be skipped in the changelog')
            [CompletionResult]::new('-p', 'p', [CompletionResultType]::ParameterName, 'Prepends entries to the given changelog file')
            [CompletionResult]::new('--prepend', 'prepend', [CompletionResultType]::ParameterName, 'Prepends entries to the given changelog file')
            [CompletionResult]::new('-o', 'o', [CompletionResultType]::ParameterName, 'Writes output to the given file')
            [CompletionResult]::new('--output', 'output', [CompletionResultType]::ParameterName, 'Writes output to the given file')
            [CompletionResult]::new('-t', 't', [CompletionResultType]::ParameterName, 'Sets the tag for the latest version')
            [CompletionResult]::new('--tag', 'tag', [CompletionResultType]::ParameterName, 'Sets the tag for the latest version')
            [CompletionResult]::new('-b', 'b', [CompletionResultType]::ParameterName, 'Sets the template for the changelog body')
            [CompletionResult]::new('--body', 'body', [CompletionResultType]::ParameterName, 'Sets the template for the changelog body')
            [CompletionResult]::new('-s', 's', [CompletionResultType]::ParameterName, 'Strips the given parts from the changelog')
            [CompletionResult]::new('--strip', 'strip', [CompletionResultType]::ParameterName, 'Strips the given parts from the changelog')
            [CompletionResult]::new('--sort', 'sort', [CompletionResultType]::ParameterName, 'Sets sorting of the commits inside sections')
            [CompletionResult]::new('--github-token', 'github-token', [CompletionResultType]::ParameterName, 'Sets the GitHub API token')
            [CompletionResult]::new('--github-repo', 'github-repo', [CompletionResultType]::ParameterName, 'Sets the GitHub repository')
            [CompletionResult]::new('-h', 'h', [CompletionResultType]::ParameterName, 'Prints help information')
            [CompletionResult]::new('--help', 'help', [CompletionResultType]::ParameterName, 'Prints help information')
            [CompletionResult]::new('-V', 'V ', [CompletionResultType]::ParameterName, 'Prints version information')
            [CompletionResult]::new('--version', 'version', [CompletionResultType]::ParameterName, 'Prints version information')
            [CompletionResult]::new('-v', 'v', [CompletionResultType]::ParameterName, 'Increases the logging verbosity')
            [CompletionResult]::new('--verbose', 'verbose', [CompletionResultType]::ParameterName, 'Increases the logging verbosity')
            [CompletionResult]::new('--bump', 'bump', [CompletionResultType]::ParameterName, 'Bumps the version for unreleased changes')
            [CompletionResult]::new('--bumped-version', 'bumped-version', [CompletionResultType]::ParameterName, 'Prints bumped version for unreleased changes')
            [CompletionResult]::new('-l', 'l', [CompletionResultType]::ParameterName, 'Processes the commits starting from the latest tag')
            [CompletionResult]::new('--latest', 'latest', [CompletionResultType]::ParameterName, 'Processes the commits starting from the latest tag')
            [CompletionResult]::new('--current', 'current', [CompletionResultType]::ParameterName, 'Processes the commits that belong to the current tag')
            [CompletionResult]::new('-u', 'u', [CompletionResultType]::ParameterName, 'Processes the commits that do not belong to a tag')
            [CompletionResult]::new('--unreleased', 'unreleased', [CompletionResultType]::ParameterName, 'Processes the commits that do not belong to a tag')
            [CompletionResult]::new('--topo-order', 'topo-order', [CompletionResultType]::ParameterName, 'Sorts the tags topologically')
            [CompletionResult]::new('--no-exec', 'no-exec', [CompletionResultType]::ParameterName, 'Disables the external command execution')
            [CompletionResult]::new('-x', 'x', [CompletionResultType]::ParameterName, 'Prints changelog context as JSON')
            [CompletionResult]::new('--context', 'context', [CompletionResultType]::ParameterName, 'Prints changelog context as JSON')
            break
        }
    })

    $completions.Where{ $_.CompletionText -like "$wordToComplete*" } |
        Sort-Object -Property ListItemText
}
